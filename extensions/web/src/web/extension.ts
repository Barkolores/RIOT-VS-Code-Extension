import vscode from "vscode";
import {DeviceProvider} from "shared/ui/deviceProvider";
import {WebDevice} from "./devices/webDevice";
import {DeviceManager} from "./devices/deviceManager";
import {WebSocketManager} from "./websocket/webSocketManager";
import {FolderTreeItem} from "shared/ui/treeItems/folderTreeItem";
import {encode} from "cbor-x";
import {inboundWSMessage} from "./websocket/api/inbound/inboundWSMessage";
import {addressTypes, messageTypes, terminationTypes} from "./websocket/api/additionalTypes";
import {supportedBoards} from "./devices/supportedBoards";
import {Container} from "./placeholder";

export function activate(context: vscode.ExtensionContext) {

    if ((navigator as any).serial === undefined && (navigator as any).usb === undefined) {
        console.log("No serial or USB support found. Aborting RIOT web extension.");
        return;
    }
    //TODO remove
    Container.context = context;

    console.clear();
    console.log("RIOT web extension activated");

    //initialize Context
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.connectionEstablished', false);
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.busyDevices', []);

    const deviceProvider = new DeviceProvider();
    const {port1: devicesPort, port2: websocketPort} = new MessageChannel();
    const {port1: testPort1, port2: testPort2} = new MessageChannel();
    const deviceManager = new DeviceManager(deviceProvider, devicesPort);
    const webSocketManager = new WebSocketManager(deviceManager, websocketPort, context.extensionUri, testPort1);
    const busyDevices = new Set<string>();

    let executeEventListeners = true;
    //Serial Events
    navigator.serial.addEventListener('connect', async (event) => {
        console.log('entered connect');
        if (executeEventListeners) {
            console.log('executed connect');
            (event.target as SerialPort).forget();
        }
    });
    navigator.serial.addEventListener('disconnect', (event) => {
        console.log('entered disconnect');
        if (executeEventListeners) {
            console.log('executed disconnect');
            deviceManager.handleDisconnectEvent(event.target as SerialPort);
        }
    });

    //Commands
    context.subscriptions.push(
        //add new Device
        vscode.commands.registerCommand('riot-web-extension.device.add', async () => {
            console.log('RIOT Web Extension is registering new device...');
            while (true) {
                const board = await vscode.window.showQuickPick(supportedBoards);
                if (board) {
                    deviceManager.addDevice(board);
                    break;
                } else {
                    if (await vscode.window.showErrorMessage('No board has been selected', {modal: true}, 'Retry') === undefined) {
                        break;
                    }
                }
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
            console.log('cleanUp');
            await deviceManager.cleanUp();
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
            console.log('lock');
            executeEventListeners = false;
        }),

        //unlock EventListeners
        vscode.commands.registerCommand('riot-web-extension.eventListener.unlock', async () => {
            console.log('unlock');
            executeEventListeners = true;
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
        vscode.commands.registerCommand('riot-web-extension.test.receiveDNR', async () => {
            const shellID = await vscode.window.showInputBox({title: 'ID of shell'});
            const deviceName = await vscode.window.showInputBox({title: 'Name of device'});
            if (!deviceName || !shellID) {
                return;
            }
            const message: inboundWSMessage = [
                messageTypes.DRM,
                [addressTypes.SHELL, Number.parseInt(shellID)],
                [addressTypes.DEVICE, deviceName]
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveSRMACK', async () => {
            const shellID = await vscode.window.showInputBox({title: 'ID of shell'});
            const deviceName = await vscode.window.showInputBox({title: 'Name of device'});
            if (!shellID || !deviceName) {
                return;
            }
            const message: inboundWSMessage = [
                messageTypes.SRM_ACK,
                [addressTypes.SHELL, Number.parseInt(shellID)],
                [addressTypes.DEVICE, deviceName]
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveLTMSuccess', async () => {
            const shellID = await vscode.window.showInputBox({title: 'ID of shell'});
            const deviceName = await vscode.window.showInputBox({title: 'Name of device'});
            if (!shellID || !deviceName) {
                return;
            }
            const message: inboundWSMessage = [
                messageTypes.LTM,
                [addressTypes.SHELL, Number.parseInt(shellID)],
                [addressTypes.DEVICE, deviceName],
                terminationTypes.SUCCESS,
                "Testing Success"
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveLTMError', async () => {
            const shellID = await vscode.window.showInputBox({title: 'ID of shell'});
            const deviceName = await vscode.window.showInputBox({title: 'Name of device'});
            if (!shellID || !deviceName) {
                return;
            }
            const message: inboundWSMessage = [
                messageTypes.LTM,
                [addressTypes.SHELL, Number.parseInt(shellID)],
                [addressTypes.DEVICE, deviceName],
                terminationTypes.ERROR,
                "Testing Error"
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveFlash', async () => {
            const shellID = await vscode.window.showInputBox({title: 'ID of shell'});
            const deviceName = await vscode.window.showInputBox({title: 'Name of device'});
            if (!shellID || !deviceName) {
                return;
            }
            const message: inboundWSMessage = [
                messageTypes.FLASH,
                [addressTypes.SHELL, Number.parseInt(shellID)],
                [addressTypes.DEVICE, deviceName],
                "esp32",
                {"0x1000": "a"},
                "arguments"
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveTerm', async () => {
            const shellID = await vscode.window.showInputBox({title: 'ID of shell'});
            const deviceName = await vscode.window.showInputBox({title: 'Name of device'});
            const baudrate = await vscode.window.showInputBox({title: 'Baudrate'});
            if (!shellID || !deviceName || !baudrate) {
                return;
            }
            const message: inboundWSMessage = [
                messageTypes.TERM,
                [addressTypes.SHELL, Number.parseInt(shellID)],
                [addressTypes.DEVICE, deviceName],
                "esp32",
                Number.parseInt(baudrate)
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.receiveInput', async () => {
            const shellID = await vscode.window.showInputBox({title: 'ID of shell'});
            const deviceName = await vscode.window.showInputBox({title: 'Name of device'});
            if (!shellID || !deviceName) {
                return;
            }
            const message: inboundWSMessage = [
                messageTypes.INPUT,
                [addressTypes.SHELL, Number.parseInt(shellID)],
                [addressTypes.DEVICE, deviceName],
                "testing Input"
            ];
            testPort2.postMessage(encode(message));
        }),
        vscode.commands.registerCommand('riot-web-extension.test.enterDFU', async () => {
            deviceManager.enterDFU();
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
