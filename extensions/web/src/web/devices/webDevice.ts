import vscode from "vscode";
import {DeviceTreeItem} from "shared/ui/treeItems/deviceTreeItem";
import {WebSocketManager} from "../websocket/webSocketManager";
import {command, inboundDeviceMessage} from "../websocket/api/inbound/inboundDeviceMessage";
import {
    addressTypes,
    commandTypes,
    deviceAddress,
    logTypes,
    messageTypes,
    shellAddress,
    terminationTypes
} from "../websocket/api/additionalTypes";
import {commandRequest, outboundDeviceMessage} from "../websocket/api/outbound/outboundDeviceMessage";
import {implementsFlashInterface} from "./flash/flashInterface.guard";

export type webPort = SerialPort /*| USBDevice*/

enum deviceAction {
    FLASH,
    TERM
}

export abstract class WebDevice extends DeviceTreeItem {
    protected _activeProject?: vscode.WorkspaceFolder;
    protected _deviceAddress: deviceAddress;
    protected _currentlyLockedTo: shellAddress | undefined = undefined;
    protected _previouslyLockedTo: shellAddress | undefined = undefined;
    protected _requestedAction: deviceAction | undefined = undefined;
    protected _flashing: boolean = false;
    protected _logBypass: boolean = false;
    static readonly _defaultShellLabel: string = 'shell';

    protected constructor(
        label: string,
        contextValue: string,
        board: string | undefined,
        protected _webPort: webPort,
        protected readonly _messagePort: MessagePort
    ) {
        super(label, contextValue, board);
        this._deviceAddress = [addressTypes.DEVICE, label];
    }

    getActiveProject(): vscode.WorkspaceFolder | undefined {
        return this._activeProject;
    }

    changeActiveProject(newProject: vscode.WorkspaceFolder) {
        this._activeProject = newProject;
    }

    changeLabel(newLabel: string) {
        this._deviceAddress[1] = newLabel;
        super.changeLabel(newLabel);
    }

    abstract comparePort(port: webPort): boolean;

    protected abstract close(): Promise<void>;

    protected abstract read(webSocketManager: WebSocketManager): void;

    protected abstract write(message: Uint8Array): void;

    protected abstract term(param?: object): void;

    forget() {
        this.cancel();
        this._webPort.forget().then(() => console.log('Forgot ' + this.label));
    };

    cancel(sendRSTMessage: boolean = true) {
        if (this._flashing) {
            if (!sendRSTMessage) {
                //Shell Terminated Connection, stop sending logs
                this._logBypass = true;
            }
            vscode.window.showErrorMessage('Device is currently flashing. Please wait till flashing is complete.');
            return;
        }
        if (this._currentlyLockedTo && sendRSTMessage) {
            this.sendRST(this._currentlyLockedTo, terminationTypes.ERROR, 'User canceled Action.');
        }
        this.close();
        this.unlockDevice();
    }

    private async checkBoard(board: string): Promise<boolean> {
        if (this._board === undefined) {
            return await vscode.window.showWarningMessage(`No board has been specified for the Device. Board of type ${board} will be used instead. This can lead to problems.`, {modal: true}, 'Continue Anyway') !== undefined;
        }
        if (this._board !== board) {
            return await vscode.window.showWarningMessage(`The board ${board} does not match the specified board of the Device (${this._board}). This can lead to problems.`, {modal: true}, 'Continue Anyway') !== undefined;
        }
        return true;
    }

    private sendMessage(message: outboundDeviceMessage): void {
        this._messagePort.postMessage(message);
    }

    private sendRST(receiver: shellAddress, terminationType: terminationTypes, reason: string) {
        this.sendMessage([
            messageTypes.RST,
            this._deviceAddress,
            receiver,
            terminationType,
            reason
        ] as outboundDeviceMessage);
    };

    protected sendLog(message: string) {
        if (!this._logBypass) {
            this.sendMessage([
                messageTypes.LOG,
                this._deviceAddress,
                this._currentlyLockedTo,
                logTypes.LOG,
                message
            ] as outboundDeviceMessage);
        }
    }

    protected sendIO(message: Uint8Array<ArrayBufferLike>) {
        if (!this._logBypass) {
            this.sendMessage([
                messageTypes.IO,
                this._deviceAddress,
                this._currentlyLockedTo,
                message
            ] as outboundDeviceMessage);
        }
    }

    private unlockDevice() {
        this._requestedAction = undefined;
        if (this._currentlyLockedTo) {
            this.renameTerminal(WebDevice._defaultShellLabel).finally(() => {
                this._previouslyLockedTo = this._currentlyLockedTo;
                this._currentlyLockedTo = undefined;
            });
        }
        this._logBypass = false;
        vscode.commands.executeCommand('riot-web-extension.context.device.remove', this.contextValue);
    }

    requestFlash() {
        if (!implementsFlashInterface(this)) {
            vscode.window.showErrorMessage(`Flashing ${this._board ? this._board : 'an unknown board'} is not supported in the Web.`, {modal: true});
            return;
        }
        if (!this._activeProject) {
            vscode.window.showErrorMessage('No project in which to execute the flash command has been specified. Cancelling Flash...', {modal: true});
            return;
        }
        if (this._currentlyLockedTo === undefined) {
            vscode.commands.executeCommand('riot-web-extension.context.device.add', this.contextValue);
            this._requestedAction = deviceAction.FLASH;
            this.requestShell();
        } else {
            vscode.window.showErrorMessage('Device is busy');
        }
    }

    requestTerm() {
        if (!this._activeProject) {
            vscode.window.showErrorMessage('No project in which to execute the term command has been specified. Cancelling Term...', {modal: true});
            return;
        }
        if (this._currentlyLockedTo === undefined) {
            vscode.commands.executeCommand('riot-web-extension.context.device.add', this.contextValue);
            this._requestedAction = deviceAction.TERM;
            this.requestShell();
        } else {
            vscode.window.showErrorMessage('Device is busy');
        }
    }

    private async requestShell() {
        let newInstance = false;
        if (this._previouslyLockedTo) {
            this._currentlyLockedTo = this._previouslyLockedTo;
        } else {
            await vscode.commands.executeCommand('workbench.action.terminal.newWithCwd', {
                cwd: this._activeProject
            });
            const processId = await vscode.window.activeTerminal?.processId;
            if (!processId) {
                vscode.window.showErrorMessage('ProcessId was undefined, cannot connect to Shell');
                this.unlockDevice();
                return;
            }
            newInstance = true;
            this._currentlyLockedTo = [addressTypes.SHELL, processId];
        }
        let commandRequest = undefined;
        switch (this._requestedAction) {
            case deviceAction.FLASH:
                commandRequest = [
                    'flash',
                    this._board ? this._board : WebDevice._defaultBoard,
                    this._activeProject ? this._activeProject.uri.path : '',
                ] as commandRequest;
                break;
            case deviceAction.TERM:
                commandRequest = [
                    'term',
                    this._board ? this._board : WebDevice._defaultBoard,
                    this._activeProject ? this._activeProject.uri.path : '',
                ] as commandRequest;
                break;
            default:
                vscode.window.showErrorMessage('Unsupported action requested');
                this.unlockDevice();
                return;
        }

        this.sendMessage([
            messageTypes.REQ,
            this._deviceAddress,
            this._currentlyLockedTo,
            newInstance,
            commandRequest
        ] as outboundDeviceMessage);
    }

    async handleMessage(message: inboundDeviceMessage): Promise<void> {
        //prepass to check for linkage with right shell
        switch (message[0]) {
            case messageTypes.CMD:
                //Send RST response when receiving cmd messages from unknown shells (but accept if not locked to any shell to establish new connection)
                if (this._currentlyLockedTo !== undefined && (this._currentlyLockedTo[0] !== message[1][0] || this._currentlyLockedTo[1] !== message[1][1])) {
                    this.sendRST(message[1], terminationTypes.ERROR, 'Device has established a connection with a different Shell.');
                    return;
                }
                break;
            default:
                //Send RST response when receiving non cmd messages from unknown shells
                if (this._currentlyLockedTo === undefined || this._currentlyLockedTo[0] !== message[1][0] || this._currentlyLockedTo[1] !== message[1][1]) {
                    //Drop RST to prevent infinite RST loop
                    if (message[0] !== messageTypes.RST) {
                        this.sendRST(message[1], terminationTypes.ERROR, this._currentlyLockedTo ? 'Device has established a connection with a different Shell.' : 'A connection to this Device has to be established first.');
                    }
                    return;
                }
                break;
        }


        //actual message handling
        switch (message[0]) {
            case messageTypes.ACK:
                this._requestedAction = undefined;
                //rename and focus shell, wait for further instructions from shell
                await this.renameTerminal(this.label + ' | Busy', true);
                break;
            case messageTypes.RST:
                if (this._requestedAction !== undefined) {
                    //shell is busy or gone, find new one
                    this._previouslyLockedTo = undefined;
                    vscode.window.showInformationMessage(`The last shell Device ${this.label} used isn't available anymore. Spawning new shell.`);
                    this.requestShell();
                    return;
                }
                if (message[3] === terminationTypes.SUCCESS) {
                    vscode.window.showInformationMessage(message[4]);
                } else {
                    vscode.window.showErrorMessage(message[4]);
                }
                this.cancel(false);
                break;
            case messageTypes.CMD:
                //new connection, lock to new shell
                if (this._requestedAction) {
                    //Received CMD before ACK, sequence break not allowed
                    vscode.window.showErrorMessage('Received CMD before ACK.');
                    this.unlockDevice();
                    return;
                }
                await this.executeCommand(message[3]);
                break;
            case messageTypes.IO:
                this.write(message[3]);
                break;
        }
    }

    async executeCommand(command: command) {
        switch (command[0]) {
            case commandTypes.FLASH:
                if (!implementsFlashInterface(this)) {
                    if (this._currentlyLockedTo) {
                        this.sendRST(this._currentlyLockedTo, terminationTypes.ERROR, `Flashing ${this._board ? this._board : 'an unknown board'} is not supported in the Web.`);
                    }
                    vscode.window.showErrorMessage(`Flashing ${this._board ? this._board : 'an unknown board'} is not supported in the Web.`, {modal: true});
                    this.unlockDevice();
                    return;
                }
                if (await this.checkBoard(command[1])) {
                    this._flashing = true;
                    await this.renameTerminal(this.label + ' | Flash');
                    await this.flash(command[2], command[3]).then(() => {
                        if (this._currentlyLockedTo) {
                            this.sendRST(this._currentlyLockedTo, terminationTypes.SUCCESS, `Flash complete.`);
                        }
                        console.log('Flash complete');
                    }).catch((e) => {
                        if (this._currentlyLockedTo) {
                            this.sendRST(this._currentlyLockedTo, terminationTypes.ERROR, `Flash failed.`);
                        }
                        console.error('Flash failed', e);
                    }).finally(async () => {
                        await vscode.commands.executeCommand('riot-web-extension.eventListener.unlock');
                        await vscode.commands.executeCommand('riot-web-extension.device.cleanUp');
                        this._flashing = false;
                        this.unlockDevice();
                    });
                } else {
                    this.unlockDevice();
                }
                break;
            case commandTypes.TERM:
                if (await this.checkBoard(command[1])) {
                    await this.renameTerminal(this.label + ' | Term');
                    this.term({
                        baudRate: command[2]
                    } as SerialOptions);
                } else {
                    this.unlockDevice();
                }
                break;
        }
    }

    getShellId() {
        //returns the ID of the shell the device is currently locked to (or else undefined)
        //only used for terminal closed callback
        if (this._currentlyLockedTo) {
            return this._currentlyLockedTo[1];
        }
    }

    async renameTerminal(newName: string, focus: boolean = false) {
        if (this._currentlyLockedTo) {
            const id = this._currentlyLockedTo[1];
            const activeTerminal = vscode.window.activeTerminal;
            for (const terminal of vscode.window.terminals) {
                if (id === await terminal.processId) {
                    const isDifferentTerminal = activeTerminal !== terminal;
                    if (isDifferentTerminal) {
                        terminal.show(true);
                    }
                    await vscode.commands.executeCommand('workbench.action.terminal.renameWithArg', {
                        name: newName
                    });
                    if (!focus && isDifferentTerminal) {
                        activeTerminal?.show(true);
                    }
                    break;
                }
            }
        }
    }
}