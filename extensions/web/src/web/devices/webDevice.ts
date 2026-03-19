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

export type webPort = SerialPort | USBDevice

enum deviceAction {
    FLASH,
    TERM
}

export abstract class WebDevice extends DeviceTreeItem {
    protected _deviceAddress: deviceAddress;
    protected _currentlyLockedTo: shellAddress | undefined = undefined;
    protected _previouslyLockedTo: shellAddress | undefined = undefined;
    protected _requestedAction: deviceAction | undefined = undefined;
    protected _flashing: boolean = false;
    protected _logMessages: string = '';
    protected _logMessagesTimer: NodeJS.Timeout | undefined = undefined;

    protected constructor(
        label: string,
        contextValue: string,
        board: string,
        protected _webPort: webPort,
        protected readonly _messagePort: MessagePort
    ) {
        super(label, contextValue, board);
        this._deviceAddress = [addressTypes.DEVICE, label];
    }

    changeLabel(newLabel: string) {
        this._deviceAddress[1] = newLabel;
        super.changeLabel(newLabel);
    }

    abstract comparePort(port: webPort): boolean;

    protected abstract close(): Promise<void>;

    protected abstract read(webSocketManager: WebSocketManager): void;

    protected abstract write(message: string): void;

    protected abstract term(param?: object): void;

    forget() {
        this.cancel();
        this._webPort.forget().then(() => console.log('Forgot ' + this.label));
    };

    cancel() {
        if (this._flashing) {
            vscode.window.showErrorMessage('Device is currently flashing. Please wait till flashing is complete.');
            return;
        }
        if (this._currentlyLockedTo) {
            this.sendRST(this._currentlyLockedTo, terminationTypes.ERROR, 'User canceled Action.');
        }
        this.close();
        this.unlockDevice();
    }

    private async checkBoard(board: string): Promise<boolean> {
        if (this._board && this._board !== board || !this._board && WebDevice._defaultBoard !== board) {
            return await vscode.window.showErrorMessage(`The board used for the Term/Flash does not match the specified board. Board of type ${WebDevice._defaultBoard} will be used instead.`, {modal: true}, 'Continue') !== undefined;
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

    protected sendLog() {
        if (this._logMessages !== '') {
            this.sendMessage([
                messageTypes.LOG,
                this._deviceAddress,
                this._currentlyLockedTo,
                logTypes.LOG,
                this._logMessages
            ] as outboundDeviceMessage);
            this._logMessages = '';
        }
    }

    protected startLogBundling() {
        this.stopLogBundling();
        this._logMessagesTimer = setInterval(this.sendLog.bind(this), 100);
    }

    protected stopLogBundling() {
        clearInterval(this._logMessagesTimer);
        //send out any remaining logs
        this.sendLog();
    }

    private unlockDevice() {
        this._requestedAction = undefined;
        if (this._currentlyLockedTo) {
            this._previouslyLockedTo = this._currentlyLockedTo;
            this._currentlyLockedTo = undefined;
        }
        vscode.commands.executeCommand('riot-web-extension.context.device.remove', this.contextValue);
        this.stopLogBundling();
    }

    requestFlash() {
        if (!implementsFlashInterface(this)) {
            vscode.window.showErrorMessage(`Flashing ${this._board} is not supported in the Web.`, {modal: true});
            return;
        }
        if (!this._activeProject) {
            vscode.window.showErrorMessage('No project in which to execute the flash command has been specified. Cancelling Flash...', {modal: true});
            return;
        }
        if (!this._board) {
            vscode.window.showWarningMessage(`No board has been specified. Board of type ${WebDevice._defaultBoard} will be used.`);
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
        if (!this._board) {
            vscode.window.showWarningMessage(`No board has been specified. Board of type ${WebDevice._defaultBoard} will be used.`);
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
            await vscode.commands.executeCommand('workbench.action.terminal.new');
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
                //TODO focus shell
                //wait for further instructions from shell
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
                this.close();
                this.unlockDevice();
                break;
            case messageTypes.CMD:
                //new connection, lock to new shell
                if (this._requestedAction) {
                    //Received CMD before ACK, sequence break not allowed
                    vscode.window.showErrorMessage('Received CMD before ACK.');
                    this.unlockDevice();
                    return;
                }
                if (this._currentlyLockedTo === undefined) {
                    vscode.commands.executeCommand('riot-web-extension.context.device.add', this.contextValue);
                    this._currentlyLockedTo = message[1];
                }
                await this.executeCommand(message[3]);
                break;
            case messageTypes.INPUT:
                this.write(message[3]);
                break;
        }
    }

    async executeCommand(command: command) {
        switch (command[0]) {
            case commandTypes.FLASH:
                if (!implementsFlashInterface(this)) {
                    if (this._currentlyLockedTo) {
                        this.sendRST(this._currentlyLockedTo, terminationTypes.ERROR, `Flashing ${this._board} is not supported in the Web.`);
                    }
                    vscode.window.showErrorMessage(`Flashing ${this._board} is not supported in the Web.`, {modal: true});
                    this.unlockDevice();
                    return;
                }
                if (await this.checkBoard(command[1])) {
                    this.startLogBundling();
                    this._flashing = true;
                    await this.flash(command[2], command[3]).finally(async () => {
                        await vscode.commands.executeCommand('riot-web-extension.eventListener.unlock');
                        await vscode.commands.executeCommand('riot-web-extension.device.cleanUp');
                        this._flashing = false;
                        this.stopLogBundling();
                        this.unlockDevice();
                    });
                }
                break;
            case commandTypes.TERM:
                if (await this.checkBoard(command[1])) {
                    this.term({
                        baudRate: command[2]
                    } as SerialOptions);
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
}