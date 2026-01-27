import vscode from "vscode";
import {DeviceProvider} from "shared/ui/deviceProvider";
import {WebDevice} from "./devices/webDevice";
import {DeviceManager} from "./devices/deviceManager";
import {WebSocketManager} from "./websocket/webSocketManager";
import {FolderTreeItem} from "shared/ui/treeItems/folderTreeItem";
import {BoardTreeItem} from "shared/ui/treeItems/boardTreeItem";
import {BoardTypes} from "shared/ui/boardTypes";
import {encode} from "cbor-x";
import {inboundWSMessage} from "./websocket/api/inbound/inboundWSMessage";
import {addressTypes, messageTypes, terminationTypes} from "./websocket/api/additionalTypes";

export function activate(context: vscode.ExtensionContext) {

    if ((navigator as any).serial === undefined && (navigator as any).usb === undefined) {
        console.log("No serial or USB support found. Aborting RIOT web extension.");
        return;
    }

    console.clear();
    console.log("RIOT web extension activated");

    //initialize Context
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.connectionEstablished', false);
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.busyDevices', []);

    const deviceProvider = new DeviceProvider();
    const {port1: devicesPort, port2: websocketPort} = new MessageChannel();
    const {port1: testPort1, port2: testPort2} = new MessageChannel();
    const deviceManager = new DeviceManager(deviceProvider, devicesPort);
    const webSocketManager = new WebSocketManager(deviceManager, websocketPort, testPort1);
    let boards: string[] = [];
    const busyDevices = new Set<string>();
    readBundledBoards(context.extensionUri).then((result) => {
        console.log('Supported boards have been parsed');
        boards = result;
    });

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
                        deviceManager.updateDeviceProvider();
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

        //set custom Websocket URL
        vscode.commands.registerCommand('riot-web-extension.websocket.setURL', async () => {
            while (true) {
                let newURL = await vscode.window.showInputBox({
                    title: 'Choose a new URL for the Websocket Connection',
                    value: webSocketManager.getURL(),
                });
                if (!newURL) {
                    if (await vscode.window.showErrorMessage('No new URL was specified', {modal: true}, 'Retry') === undefined) {
                        break;
                    }
                } else {
                    webSocketManager.setURL(newURL.trim());
                    break;
                }
            }
        }),

        //add Device to context (to change UI buttons)
        vscode.commands.registerCommand('riot-web-extension.context.add', (contextValue: string) => {
            busyDevices.add(contextValue);
            vscode.commands.executeCommand('setContext', 'riot-web-extension.context.busyDevices', Array.from(busyDevices));
        }),

        //remove Device from context
        vscode.commands.registerCommand('riot-web-extension.context.remove', (contextValue: string) => {
            busyDevices.delete(contextValue);
            vscode.commands.executeCommand('setContext', 'riot-web-extension.context.busyDevices', Array.from(busyDevices));
        }),

        //test
        vscode.commands.registerCommand('riot-web-extension.test.receiveConnectACK', () => {
            const message: inboundWSMessage = [
                messageTypes.CONNECT_ACK,
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveDisconnect', () => {
            const message: inboundWSMessage = [
                messageTypes.DISCONNECT,
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveDNR', () => {
            const message: inboundWSMessage = [
                messageTypes.DNR,
                [addressTypes.SHELL, 10],
                'Hallo'
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveSRMACK', () => {
            const message: inboundWSMessage = [
                messageTypes.SRM_ACK,
                [addressTypes.SHELL, 10],
                [addressTypes.DEVICE, 20]
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveLTMSuccess', () => {
            const message: inboundWSMessage = [
                messageTypes.LTM,
                [addressTypes.SHELL, 10],
                [addressTypes.DEVICE, 20],
                terminationTypes.SUCCESS,
                "Testing Success"
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveLTMError', () => {
            const message: inboundWSMessage = [
                messageTypes.LTM,
                [addressTypes.SHELL, 10],
                [addressTypes.DEVICE, 20],
                terminationTypes.ERROR,
                "Testing Error"
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveFlash', () => {
            const message: inboundWSMessage = [
                messageTypes.FLASH,
                [addressTypes.SHELL, 10],
                [addressTypes.DEVICE, 20],
                "esp32",
                {"0x1000": "a"},
                "arguments"
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveTerm', () => {
            const message: inboundWSMessage = [
                messageTypes.TERM,
                [addressTypes.SHELL, 10],
                [addressTypes.DEVICE, 20],
                "esp32",
                115200
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveInput', () => {
            const message: inboundWSMessage = [
                messageTypes.INPUT,
                [addressTypes.SHELL, 10],
                [addressTypes.DEVICE, 20],
                "testing Input"
            ];
            testPort2.postMessage(encode(message));
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
}


export function deactivate() {
    console.log('RIOT Web Extension deactivated');
}

async function readBundledBoards(uri: vscode.Uri): Promise<string[]> {
    const fileUri = vscode.Uri.joinPath(uri, 'dist', 'boards.txt');
    const text = await vscode.workspace.fs.readFile(fileUri);
    return new TextDecoder().decode(text).split('\n').filter(line => line.length > 0);
}
