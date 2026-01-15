import vscode from "vscode";
import {DeviceProvider} from "shared/ui/deviceProvider";
import {WebDevice} from "./devices/webDevice";
import {DeviceManager} from "./devices/deviceManager";
import {WebSocketManager} from "./websocket/webSocketManager";
import {FolderTreeItem} from "shared/ui/treeItems/folderTreeItem";
import {BoardTreeItem} from "shared/ui/treeItems/boardTreeItem";
import {FileManager} from "./utility/fileManager";
import {BoardTypes} from "shared/ui/boardTypes";

export function activate(context: vscode.ExtensionContext) {

    if ((navigator as any).serial === undefined && (navigator as any).usb === undefined) {
        console.log("No serial or USB support found. Aborting RIOT web extension.");
        return;
    }

    console.log("RIOT web extension activated");

    const deviceProvider = new DeviceProvider();
    const deviceManager = new DeviceManager(deviceProvider);
    const webSocketManager: WebSocketManager = new WebSocketManager();
    const fileManager = new FileManager();
    let boards: string[] = [];
    fileManager.readBundledBoards(context.extensionUri).then((result) => {
        console.log('Supported boards have been parsed');
        boards = result;
    });

    //initialize context
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.websocketOpen', true);

    //Serial Events
    navigator.serial.addEventListener('connect', (event) => {
        deviceManager.handleConnectEvent(event.target as SerialPort);
    });
    navigator.serial.addEventListener('disconnect', (event) => {
        deviceManager.handleDisconnectEvent(event.target as SerialPort);
    });

    //Commands
    context.subscriptions.push(
        //add new Device
        vscode.commands.registerCommand('riot-web-extension.device.add', async () => {
            console.log('RIOT Web Extension is registering new device...');
            const serialPortInfo: SerialPortInfo = await vscode.commands.executeCommand(
                "workbench.experimental.requestSerialPort"
            );
            if (serialPortInfo) {
                deviceManager.checkForAddedDevices();
            } else {
                vscode.window.showErrorMessage('No new Serial Device selected!');
            }
        }),

        //remove Device
        vscode.commands.registerCommand('riot-web-extension.device.remove', (device: WebDevice) => {
            console.log('RIOT Web Extension is removing device...');
            deviceManager.removeDevice(device);
        }),

        //rename Device
        vscode.commands.registerCommand('riot-web-extension.device.rename', async (device: WebDevice)=> {
            console.log('RIOT Web Extension is waiting for new label input...');
            const currentLabel = device.label as string;
            let defaultLabel = device.label as string;
            while (true) {
                let newLabel = await vscode.window.showInputBox({
                    title: 'Choose a new label for Device "' + currentLabel + '"',
                    value: defaultLabel,
                });
                if (!newLabel) {
                    if (await vscode.window.showErrorMessage('No new label was specified', {modal: true}, 'Retry') === undefined) {
                        break;
                    }
                } else {
                    newLabel = newLabel.trim();
                    if (deviceManager.checkLabelAvailable(newLabel, currentLabel)) {
                        device.changeLabel(newLabel);
                        deviceManager.sortDevices();
                        break;
                    } else {
                        if (await vscode.window.showErrorMessage('New label is already in use. Please specify a unique label.', {modal: true}, 'Retry') === undefined) {
                            break;
                        }
                        defaultLabel = newLabel;
                    }
                }
            }
        }),

        //select project
        vscode.commands.registerCommand('riot-web-extension.device.selectProject', async (folderItem: FolderTreeItem) => {
            const device = folderItem.getParentDevice();
            const folders = vscode.workspace.workspaceFolders;
            if (!folders) {
                vscode.window.showWarningMessage("No open projects.");
                return;
            }
            
            const pick = await vscode.window.showQuickPick(
                folders.map(f => ({ label: f.name, folder: f })), {
                    placeHolder: `Select project for ${device.label}`
                }
            );

            if (!pick) {
                const activeProject = device.getActiveProject();
                vscode.window.showWarningMessage(`No Selection: ${device.label} still uses ${(activeProject) ? activeProject.name : "none"}`);
                return;
            }
            device.changeActiveProject(pick.folder);
            vscode.window.showInformationMessage(
                `Project '${pick.folder.name}' assigned to ${device.label}`
            );
            deviceManager.refreshDeviceProvider();
        }),

        //select board
        vscode.commands.registerCommand('riot-web-extension.device.selectBoard', async (boardTreeItem: BoardTreeItem) => {
            if (boards.length === 0) {
                vscode.window.showErrorMessage('Supported boards have not been parsed yet. Please try again in a few moments.');
                return;
            }
            const device = boardTreeItem.getParentDevice();
            const label = device.label as string;
            while (true) {
                const pick : string | undefined = await vscode.window.showQuickPick(boards, {
                    title: 'Select a new board for Device "' + label + '"',
                    placeHolder: 'Select new board for device'
                });
                if (!pick) {
                    if (await vscode.window.showErrorMessage('No new board was specified', {modal: true}, 'Retry') === undefined) {
                        break;
                    }
                } else {
                    //Placeholder
                    device.changeBoard({
                        id: pick,
                        name: pick,
                        loaderType: "esp"
                    } as BoardTypes);
                    break;
                }
            }
            deviceManager.refreshDeviceProvider();
        }),

        //make Term
        vscode.commands.registerCommand('riot-web-extension.device.term', async (device: WebDevice)=> {
            if (!webSocketManager.isOpen()) {
                vscode.window.showErrorMessage('Cannot make Terminal. Websocket is not connected.');
            }

        }),

        //flash Device
        vscode.commands.registerCommand('riot-web-extension.device.flash', async (device: WebDevice) => {
            if (!webSocketManager.isOpen()) {
                vscode.window.showErrorMessage('Cannot flash Device. Websocket is not connected.');
            }
        }),

        //open Websocket
        vscode.commands.registerCommand('riot-web-extension.websocket.open', () => {
            webSocketManager.open();
        }),

        //close Websocket
        vscode.commands.registerCommand('riot-web-extension.websocket.close', () => {
            webSocketManager.close();
        }),
    );

    //Views
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("riot-web-extension.view.devices", deviceProvider)
    );

    // Websocket
    webSocketManager.open();
    context.subscriptions.push(
        {dispose: webSocketManager.close}
    );
}


export function deactivate() {
    console.log('RIOT Web Extension deactivated');
}
