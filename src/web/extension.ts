import vscode from "vscode";
import {type FlashOptions, type LoaderOptions} from "esptool-js";
import {FileProvider} from "./providers/fileProvider";
import {DevicesProvider} from "./providers/devicesProvider";
import {Device} from "./devices/device";
import {SerialDevice} from "./devices/serialDevice";
import {DeviceManager} from "./devices/deviceManager";
import {RiotTerminalState, TerminalProvider} from "./providers/terminalProvider";
import { CommandSocket } from "./command/commandSocket";

export function activate(context: vscode.ExtensionContext) {
    if ((navigator as any).serial === undefined) {
        console.log("Navigator Serial not found");
        return;
    }
    console.log('RIOT Web Extension activated');

    const devicesProvider = new DevicesProvider();
    const terminalProvider = new TerminalProvider(context.extensionUri);
    const fileProvider = new FileProvider();
    const deviceManager = new DeviceManager(devicesProvider);
    navigator.serial.addEventListener('connect', (event) => {
        deviceManager.handleConnectEvent(event.target as SerialPort);
    });
    navigator.serial.addEventListener('disconnect', (event) => {
        deviceManager.handleDisconnectEvent(event.target as SerialPort);
    });
    let openDevices: string[] = [];
    vscode.commands.executeCommand('setContext', 'riot-web-extension.openDevices', []);
    vscode.commands.executeCommand('setContext', 'riot-web-extension.flashingDevices', []);
    
    console.log(`Host: ${self.location.hostname}`);
    const commandSocket = new CommandSocket(self.location.hostname);

    //Commands
    context.subscriptions.push(
        //add new Device
        vscode.commands.registerCommand('riot-web-extension.serial.add', async () => {
            console.log('RIOT Web Extension is registering new Device...');
            const serialPortInfo: SerialPortInfo = await vscode.commands.executeCommand(
                "workbench.experimental.requestSerialPort"
            );
            if (serialPortInfo) {
                vscode.window.showInformationMessage(`New Serial Device connected!\nUSBVendorID: ${serialPortInfo.usbVendorId}\nUSBProductID: ${serialPortInfo.usbProductId}`);
                deviceManager.checkForAddedDevice();
            } else {
                vscode.window.showErrorMessage('No new Serial Device selected!');
            }
        }),

        //remove Device
        vscode.commands.registerCommand('riot-web-extension.serial.remove', (device: Device) => {
            console.log('RIOT Web Extension is removing Device...');
            deviceManager.removeDevice(device);
        }),

        //clear Terminal
        vscode.commands.registerCommand('riot-web-extension.terminal.clear', () => {
            terminalProvider.clearTerminal();
        }),

        // Select Device Project
        vscode.commands.registerCommand('riot-web-extension.device.selectProject', async (device: Device) => {
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
                vscode.window.showWarningMessage(`No Selection: ${device.label} still uses ${(device.activeProject) ? device.activeProject.name : "none"}`);
                return;
            }
            device.activeProject = pick.folder;
            vscode.window.showInformationMessage(
                `Project '${pick.folder.name}' assigned to ${device.label}`
            );
        }),

        //open Terminal for Communication
        vscode.commands.registerCommand('riot-web-extension.terminal.openCommunication', async (device: Device) => {
            if (!(device instanceof SerialDevice)) {
                return;
            }
            await device.open({
                baudRate: 115200
            });
            terminalProvider.addDevice(device, RiotTerminalState.COMMUNICATION);
            device.read(terminalProvider);
        }),

        //close Terminal
        vscode.commands.registerCommand('riot-web-extension.terminal.close', async (device: Device) => {
            await device.close();
            terminalProvider.removeDevice(device);
        }),

        //flash Device
        vscode.commands.registerCommand('riot-web-extension.serial.flash', async (device: Device) => {
            if (!(device instanceof SerialDevice)) {
                return;
            }
            terminalProvider.addDevice(device, RiotTerminalState.FLASH);
            const json = await fileProvider.loadJson(vscode.Uri.joinPath(context.extensionUri, 'flash', 'flasherArgs.json')) as FlasherArgsJson;
            const loaderOptions: LoaderOptions = {
                transport: device.getTransport(),
                baudrate: json.baud_rate,
                terminal: {
                    clean() {
                        terminalProvider.clearTerminal();
                    },
                    write(data: string) {
                        terminalProvider.postMessage(device.contextValue, data);
                    },
                    writeLine(data: string) {
                        terminalProvider.postMessage(device.contextValue, data + '\n');
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
            await device.flash({
                loaderOptions: loaderOptions,
                flashOptions: flashOptions
            });
        }),
        //context connect
        vscode.commands.registerCommand('riot-web-extension.context.connect', (contextValue: string) => {
            openDevices = [
                ...openDevices,
                contextValue
            ];
            vscode.commands.executeCommand('setContext', 'riot-web-extension.openDevices', openDevices);
        }),
        //context disconnect
        vscode.commands.registerCommand('riot-web-extension.context.disconnect', (contextValue: string) => {
            const index = openDevices.indexOf(contextValue);
            if (index !== -1) {
                openDevices.splice(index, 1);
                vscode.commands.executeCommand('setContext', 'riot-web-extension.openDevices', openDevices);
            }
        }),
    );



    //Views
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("riot-web-extension.view.terminal", terminalProvider, {webviewOptions: {retainContextWhenHidden: true}}),
        vscode.window.registerTreeDataProvider("riot-web-extension.view.devices", devicesProvider)
    );

    //CleanUp
    context.subscriptions.push(
        { dispose: commandSocket.close }
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
