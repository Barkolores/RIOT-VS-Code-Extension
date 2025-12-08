import vscode from "vscode";
import {DevicesProvider} from "./providers/devicesProvider";
import {WebDevice} from "./devices/webDevice";
import {DeviceManager} from "./devices/deviceManager";
import {TerminalProvider} from "./providers/terminalProvider";
import {SerialDevice} from "./devices/serialDevice";
import {FlashOptions, LoaderOptions} from "esptool-js";
import {FileProvider} from "./providers/fileProvider";
import {CommandSocket} from "./command/commandSocket";

export function activate(context: vscode.ExtensionContext) {
    if ((navigator as any).serial === undefined) {
        console.log("Navigator Serial not found");
        return;
    }
    console.log('RIOT Web Extension activated');

    const devicesProvider = new DevicesProvider();
    const fileProvider = new FileProvider();
    const deviceManager = new DeviceManager(devicesProvider);
    const terminalProvider = new TerminalProvider(context.extensionUri);
    let commandSocket: CommandSocket | undefined = undefined;

    navigator.serial.addEventListener('connect', (event) => {
        deviceManager.handleConnectEvent(event.target as SerialPort);
    });
    navigator.serial.addEventListener('disconnect', (event) => {
        const uuid = deviceManager.handleDisconnectEvent(event.target as SerialPort);
        if (uuid) {
            terminalProvider.closeTab(uuid, true);
        }
    });

    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.openTabs', []);
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.terminalVisible', false);
    vscode.commands.executeCommand('setContext', 'riot-web-extension.context.websocketOpen', false);

    //Commands
    context.subscriptions.push(
        //add new Device
        vscode.commands.registerCommand('riot-web-extension.device.add', async () => {
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
        vscode.commands.registerCommand('riot-web-extension.device.remove', (device: WebDevice) => {
            console.log('RIOT Web Extension is removing Device...');
            deviceManager.removeDevice(device);
        }),

        //clear Terminal
        vscode.commands.registerCommand('riot-web-extension.terminal.clear', () => {
            terminalProvider.clearTerminal();
        }),

        // Select Device Project
        vscode.commands.registerCommand('riot-web-extension.device.selectProject', async (device: WebDevice) => {
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
            deviceManager.refreshDevicesProvider();
        }),

        //open Tab
        vscode.commands.registerCommand('riot-web-extension.terminal.openTab', (device: WebDevice) => {
            vscode.commands.executeCommand('riot-web-extension.view.terminal.focus');
            terminalProvider.openTab(device);
        }),

        //close Tab
        vscode.commands.registerCommand('riot-web-extension.terminal.closeTab', (device: WebDevice) => {
            terminalProvider.closeTab(device.contextValue, false);
        }),

        //flash Device
        vscode.commands.registerCommand('riot-web-extension.device.flash', async (device: WebDevice) => {
            if (!(device instanceof SerialDevice)) {
                return;
            }
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
            deviceManager.refreshDevicesProvider();
        }),
        //Open Websocket
        vscode.commands.registerCommand('riot-web-extension.websocket.open', () => {
            if (commandSocket) {
                return;
            }
            //Returns protocol in Regex Group 1 and host in Group 2 without first subdomain and path (because it is added by vscode executing the extension in a webworker)
            const url = /^(.*?):.*\.([^;]*?)[:|\/]/.exec(location.pathname);
            if (!url) {
                vscode.window.showErrorMessage('URL could not be parsed');
                return;
            }
            commandSocket = new CommandSocket(url[1], url[2]);
        }),
        //Close Websocket
        vscode.commands.registerCommand('riot-web-extension.websocket.close', () => {
            if (commandSocket) {
                commandSocket.close();
            }
            commandSocket = undefined;
        })
    );

    //Views
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("riot-web-extension.view.terminal", terminalProvider, {webviewOptions: {retainContextWhenHidden: true}}),
        vscode.window.registerTreeDataProvider("riot-web-extension.view.devices", devicesProvider)
    );

    //CleanUp
    //context.subscriptions.push(
    //    { dispose: commandSocket.close }
    //);
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
