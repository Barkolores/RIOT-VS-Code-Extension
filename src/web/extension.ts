import * as vscode from 'vscode';
import {SerialDevice} from "./serial";
import {DevicesProvider, SerialTreeItem} from "./providers/devicesProvider";
import {TerminalProvider, TerminalState} from "./providers/terminalProvider";
import {type FlashOptions, type LoaderOptions} from "esptool-js";
import {FileProvider} from "./providers/fileProvider";

export function activate(context: vscode.ExtensionContext) {
    if ((navigator as any).serial === undefined) {
        console.log("Navigator Serial not found");
        return;
    }

    console.log('RIOT Web Extension activated');

    vscode.commands.executeCommand('setContext', 'riot-web.openDevice', 'none');

    const devicesProvider = new DevicesProvider();

    const terminalProvider = new TerminalProvider(context.extensionUri);

    const fileProvider = new FileProvider();

    let devices: SerialDevice[] = [];

    let serialPorts: SerialPort[] = [];

    function updateDevices(add:boolean, index?: number) {
        if (add) {
            //add Device
            navigator.serial.getPorts().then((ports) => {
                for (const port of ports) {
                    if (!serialPorts.includes(port)) {
                        serialPorts.push(port);
                        devices.push(new SerialDevice(port, crypto.randomUUID()));
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
            devices.push(new SerialDevice(port, crypto.randomUUID()));
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

    context.subscriptions.push(vscode.commands.registerCommand('riot-web.serial.flash', async (serialTreeItem: SerialTreeItem) => {
        console.log('start');
        vscode.commands.executeCommand('riot-web.serial.terminal.focus');
        terminalProvider.setTerminalState(TerminalState.FLASH);
        const json = await fileProvider.loadJson(vscode.Uri.joinPath(context.extensionUri, 'flash', 'flasherArgs.json')) as FlasherArgsJson;
        const loaderOptions: LoaderOptions = {
            transport: devices[serialTreeItem.index].getTransport(),
            baudrate: json.baud_rate,
            terminal: {
                clean() {
                    terminalProvider.clearTerminal();
                },
                write(data: string) {
                    terminalProvider.postMessage(data);
                },
                writeLine(data: string) {
                    terminalProvider.postMessage(data + '\n');
                }
            },
            debugLogging: true
        } as LoaderOptions;

        // process binary data to flash
        let file_array: { address: number; data: string }[] = [];
        for (const [key, value] of Object.entries(json.data)) {
            console.log(key, value);
            const address: number = parseInt(key, 16);
            if(isNaN(address)) {
                throw new Error(`importFlasherArgs: Invalid address for file ${key}!`);
            }
            const data: string = await fileProvider.loadBinary(vscode.Uri.joinPath(context.extensionUri, 'flash', value));
            file_array.push({ address, data });
        }

        // determine flash size
        let flashSize = json.flash_size;
        if(flashSize === "detect") {
            flashSize = "keep";
        }

        const flashOptions = {
            fileArray: file_array,
            flashSize: flashSize,
            flashMode: json.flash_mode,
            flashFreq: json.flash_freq,
            compress: json.compress,
            eraseAll: json.erase_all
        } as FlashOptions;
        await devices[serialTreeItem.index].flash(loaderOptions, flashOptions);
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

type FlasherArgsJson = {
    baud_rate: number;
    flash_size: string;
    flash_mode: string;
    flash_freq: string;
    compress: boolean;
    erase_all: boolean;
    data: Record<string, string>;
}
