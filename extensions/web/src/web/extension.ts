import vscode from "vscode";
import {DeviceProvider} from "shared/ui/deviceProvider";
import {WebDevice} from "./devices/webDevice";
import {DeviceManager} from "./devices/deviceManager";
import {WebSocketManager} from "./websocket/webSocketManager";
import {FolderTreeItem} from "shared/ui/treeItems/folderTreeItem";
import {supportedBoards} from "./devices/supportedBoards";

export function activate(context: vscode.ExtensionContext) {

    //navigator serial not available in non secure context
    if (!isSecureContext) {
        vscode.window.showErrorMessage('Context is not secure. Aborting RIOT web extension.');
        return;
    }

    //api compatibility check, can be extended with HID or USB
    if ((navigator as any).serial === undefined) {
        vscode.window.showErrorMessage("No serial support found. Aborting RIOT web extension.");
        return;
    }

    console.log("RIOT web extension activated");

    //initialize Context
    //dont display ui buttons before connection to websocket server is established
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.connectionEstablished', false);
    //switch ui buttons between flash/term and cancel
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.busyDevices', []);

    const deviceProvider = new DeviceProvider();
    const {port1: devicesPort, port2: websocketPort} = new MessageChannel();
    const deviceManager = new DeviceManager(deviceProvider, devicesPort);
    const webSocketManager = new WebSocketManager(deviceManager, websocketPort, context.extensionUri);
    const busyDevices = new Set<string>();

    //bypass for eventListeners ()
    let executeEventListeners = true;

    //Serial Events
    //Reconnect Event (when reconnecting already known device) => forget, state can not be serialized
    navigator.serial.addEventListener('connect', (event) => {
        if (executeEventListeners) {
            (event.target as SerialPort).forget();
        }
    });
    //Disconnect event => update UI
    navigator.serial.addEventListener('disconnect', (event) => {
        if (executeEventListeners) {
            deviceManager.handleDisconnectEvent(event.target as SerialPort);
        }
    });

    //Commands
    context.subscriptions.push(
        //add new Device
        vscode.commands.registerCommand('riot-web-extension.device.add', async () => {
            console.log('RIOT Web Extension is registering new device...');
            const board = await vscode.window.showQuickPick(supportedBoards);
            if (board) {
                await deviceManager.addDevice(board);
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
                    if (newLabel.includes(' ')) {
                        if (await vscode.window.showErrorMessage('New label must not contain spaces. Please specify a unique label without spaces.', {modal: true}, 'Retry') === undefined) {
                            break;
                        }
                        defaultLabel = newLabel;
                        continue;
                    }
                    if (deviceManager.checkLabelAvailable(newLabel, currentLabel)) {
                        device.changeLabel(newLabel);
                        deviceManager.updateDeviceProvider();
                        break;
                    } else {
                        if (await vscode.window.showErrorMessage('New label is already in use. Please specify a unique label without spaces.', {modal: true}, 'Retry') === undefined) {
                            break;
                        }
                        defaultLabel = newLabel;
                    }
                }
            }
        }),

        //select project
        vscode.commands.registerCommand('riot-web-extension.device.selectProject', async (folderItem: FolderTreeItem) => {
            const device = folderItem.getParentDevice() as WebDevice;
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

        //term
        vscode.commands.registerCommand('riot-web-extension.device.term', (device: WebDevice)=> {
            if (!webSocketManager.isReady()) {
                vscode.window.showErrorMessage('Cannot open Terminal. Connection to WebsocketServer is not fully established.');
                return;
            }
            device.requestTerm();
        }),

        //flash
        vscode.commands.registerCommand('riot-web-extension.device.flash', (device: WebDevice) => {
            if (!webSocketManager.isReady()) {
                vscode.window.showErrorMessage('Cannot flash device. Connection to WebsocketServer is not fully established.');
                return;
            }
            device.requestFlash();
        }),

        //cancel current Action
        vscode.commands.registerCommand('riot-web-extension.device.cancelAction', (device: WebDevice) => {
           device.cancel();
        }),

        //cleanUp devices
        vscode.commands.registerCommand('riot-web-extension.device.cleanUp', async () => {
            await deviceManager.cleanUp();
        }),

        //set custom Websocket URL
        vscode.commands.registerCommand('riot-web-extension.websocket.setURL', async () => {
            let newURL = await vscode.window.showInputBox({
                title: 'Choose a new URL for the Websocket Connection',
                value: webSocketManager.getURL(),
            });
            if (newURL) {
                webSocketManager.setURL(newURL.trim());
            }
        }),

        //add Device to context (to change UI buttons)
        vscode.commands.registerCommand('riot-web-extension.context.device.add', (contextValue: string) => {
            busyDevices.add(contextValue);
            vscode.commands.executeCommand('setContext', 'riot-web-extension.context.busyDevices', Array.from(busyDevices));
        }),

        //remove Device from context
        vscode.commands.registerCommand('riot-web-extension.context.device.remove', (contextValue: string) => {
            busyDevices.delete(contextValue);
            vscode.commands.executeCommand('setContext', 'riot-web-extension.context.busyDevices', Array.from(busyDevices));
        }),

        //lock EventListeners
        vscode.commands.registerCommand('riot-web-extension.eventListener.lock', async () => {
            executeEventListeners = false;
        }),

        //unlock EventListeners
        vscode.commands.registerCommand('riot-web-extension.eventListener.unlock', async () => {
            executeEventListeners = true;
        })
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

    //Terminal Opened Callback, set default name (important when refreshing page)
    vscode.window.onDidOpenTerminal(async (terminal) => {
        terminal.show(true);
        await vscode.commands.executeCommand('workbench.action.terminal.renameWithArg', {
            name: WebDevice._defaultShellLabel
        });
    });

    //Terminal Closed Callback, cancel device action
    vscode.window.onDidCloseTerminal(async (terminal) => {
        const processId = await terminal.processId;
        if (processId) {
            deviceManager.handleClosedTerminal(processId);
        }
    });

}


export function deactivate() {
    console.log('RIOT Web Extension deactivated');
}
