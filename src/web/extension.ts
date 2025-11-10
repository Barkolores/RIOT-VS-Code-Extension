import * as vscode from 'vscode';
import {SerialDevice} from "./serial";
import {DevicesProvider, SerialTreeItem} from "./providers/devicesProvider";
import {TerminalProvider, TerminalState} from "./providers/terminalProvider";

export function activate(context: vscode.ExtensionContext) {
    if ((navigator as any).serial === undefined) {
        console.log("Navigator Serial not found");
        return;
    }

    console.log('RIOT Web Extension activated');

    vscode.commands.executeCommand('setContext', 'riot-web.openDevice', 'none');

    const devicesProvider = new DevicesProvider();

    const terminalProvider = new TerminalProvider(context.extensionUri);

    let devices: SerialDevice[] = [];

    let serialPorts: SerialPort[] = [];

    let deviceIdentifier = 0;

    function updateDevices(add:boolean, index?: number) {
        if (add) {
            //add Device
            navigator.serial.getPorts().then((ports) => {
                for (const port of ports) {
                    if (!serialPorts.includes(port)) {
                        serialPorts.push(port);
                        devices.push(new SerialDevice(port, deviceIdentifier.toString()));
                        deviceIdentifier++;
                        devicesProvider.refresh(devices);
                    }
                }
            });
        } else {
            //remove Device
            if (index !== undefined) {
                //called through ui
                serialPorts.splice(index, 1);
                devices.splice(index, 1)[0].forget();
                devicesProvider.refresh(devices);
            } else {
                //disconnect event
                navigator.serial.getPorts().then((ports) => {
                    for (const serialPort of serialPorts) {
                        const index = ports.indexOf(serialPort);
                        if (index === -1) {
                            serialPorts.splice(index, 1);
                            devices.splice(index, 1);
                            devicesProvider.refresh(devices);
                        }
                    }
                });
            }
        }
    }

    navigator.serial.getPorts().then((ports) => {
        serialPorts = ports;
        for (const port of ports) {
            devices.push(new SerialDevice(port, deviceIdentifier.toString()));
            deviceIdentifier++;
        }
        devicesProvider.refresh(devices);
    });

    navigator.serial.addEventListener('connect', () => {
        updateDevices(true);
    });
    navigator.serial.addEventListener('disconnect', () => {
        updateDevices(false);
    });

    //Commands
    context.subscriptions.push(vscode.commands.registerCommand('riot-web.serial.register', async () => {
            console.log('RIOT Web Extension is registering new Device...');
            const serialPortInfo: SerialPortInfo = await vscode.commands.executeCommand(
                "workbench.experimental.requestSerialPort"
            );
            if (serialPortInfo) {
                vscode.window.showInformationMessage(`New Serial Device connected!\nUSBVendorID: ${serialPortInfo.usbVendorId}\nUSBProductID: ${serialPortInfo.usbProductId}`);
                updateDevices(true);
            } else {
                vscode.window.showErrorMessage('No new Serial Device selected!');
            }
        })
    );

    context.subscriptions.push(vscode.commands.registerCommand('riot-web.serial.remove', (serialTreeItem: SerialTreeItem) => {
        console.log('RIOT Web Extension is removing Device...');
        updateDevices(false, serialTreeItem.index);
    }));

    context.subscriptions.push(
        vscode.commands.registerCommand('riot-web.serial.clearTerminal', () => {
            terminalProvider.clearTerminal();
        })
    );

    context.subscriptions.push(vscode.commands.registerCommand('riot-web.serial.openCommunicationTerminal', async (serialTreeItem: SerialTreeItem) => {
        await devices[serialTreeItem.index].open(115200);
        terminalProvider.setDevice(devices[serialTreeItem.index]);
        vscode.commands.executeCommand('riot-web.serial.terminal.focus');
        terminalProvider.setTerminalState(TerminalState.COMMUNICATION);
        devices[serialTreeItem.index].read(terminalProvider);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('riot-web.serial.closeTerminal', async (serialTreeItem: SerialTreeItem) => {
        await devices[serialTreeItem.index].close();
        terminalProvider.setDevice();
        terminalProvider.setTerminalState(TerminalState.NONE);
    }));



    //Views
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("riot-web.serial.terminal", terminalProvider, {webviewOptions: {retainContextWhenHidden: true}})
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("riot-web.serial.devices", devicesProvider)
    );
}


export function deactivate() {
    console.log('RIOT Web Extension deactivated');
}
