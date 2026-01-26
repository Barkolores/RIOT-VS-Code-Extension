import vscode from "vscode";
import {DeviceTreeItem} from "shared/ui/treeItems/deviceTreeItem";
import {webPort} from "./webPort";
import {WebSocketManager} from "../websocket/webSocketManager";
import {inboundDeviceMessage} from "../websocket/api/inbound/inboundDeviceMessage";
import {
    addressTypes,
    deviceAddress,
    logTypes,
    messageTypes,
    shellAddress,
    terminationTypes
} from "../websocket/api/additionalTypes";
import {outboundDeviceMessage} from "../websocket/api/outbound/outboundDeviceMessage";

export enum deviceState {
    IDLE,
    WAITING_FOR_SRM_ACK,
    FLASH,
    TERM,
}

enum deviceActions {
    FLASH,
    TERM
}

export abstract class WebDevice extends DeviceTreeItem {
    protected _deviceAddress: deviceAddress;
    protected _shellAddress: shellAddress | undefined = undefined;
    protected _lastShellAddress: shellAddress | undefined = undefined;
    protected _currentState: deviceState = deviceState.IDLE;
    protected _nextAction: deviceActions | undefined = undefined;
    protected _logMessages: string[] = [];
    protected _logMessagesTimer: NodeJS.Timeout | undefined = undefined;

    protected constructor(
        protected _webPort: webPort,
        label: string,
        contextValue: string,
        protected readonly _updateTreeviewEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>,
        protected readonly _messagePort: MessagePort
    ) {
        super(label, contextValue, _updateTreeviewEventEmitter);
        this._deviceAddress = [addressTypes.DEVICE, Number.parseInt(contextValue)];
    }

    abstract comparePort(port: webPort): boolean;

    abstract forget(): void;

    abstract close(): Promise<boolean>;

    protected abstract read(webSocketManager: WebSocketManager): void;

    abstract write(message: string): void;

    abstract term(param?: object): void;

    abstract flash(param?: object): void;

    requestFlash() {
        if (this._shellAddress === undefined) {
            this._nextAction = deviceActions.FLASH;
            this.sendRequest(messageTypes.FLASH_REQUEST);
        } else {
            vscode.window.showErrorMessage('Device is busy');
        }
    }

    requestTerm() {
        if (this._shellAddress === undefined) {
            this._nextAction = deviceActions.TERM;
            this.sendRequest(messageTypes.TERM_REQUEST);
        } else {
            vscode.window.showErrorMessage('Device is busy');
        }
    }

    private unlockDevice() {
        this._currentState = deviceState.IDLE;
        this._nextAction = undefined;
        this._lastShellAddress = this._shellAddress;
        this._shellAddress = undefined;
    }

    private sendMessage(message: outboundDeviceMessage): void {
        this._messagePort.postMessage(message);
    }

    async handleMessage(message: inboundDeviceMessage): Promise<void> {
        console.log('Device received message: ', message[0]);
        if (message[0] !== 'DNR') {
            if (message[1] !== this._shellAddress) {
                this.sendLTM(message[1], terminationTypes.ERROR, 'Device has established a connection with a different Shell.');
                return;
            }
        }
        switch (message[0]) {
            case "DNR":
                if (this._shellAddress) {
                    this.sendLTM(message[1], terminationTypes.ERROR, 'Device is locked.');
                } else {
                    this._shellAddress = message[1];
                    this._messagePort.postMessage([
                        'DNR ACK',
                        this._deviceAddress,
                        this._shellAddress
                    ] as outboundDeviceMessage);
                }
                break;
            case "SRM ACK":
                if (this._currentState === deviceState.WAITING_FOR_SRM_ACK) {
                    this._currentState = deviceState.IDLE;
                    switch (this._nextAction) {
                        case deviceActions.FLASH:
                            this.sendRequest(messageTypes.FLASH_REQUEST);
                            break;
                        case deviceActions.TERM:
                            this.sendRequest(messageTypes.TERM_REQUEST);
                            break;
                        default:
                            this.sendLTM(message[1], terminationTypes.ERROR, 'Device has no further actions to take');
                            this.unlockDevice();
                    }
                }
                break;
            case "LTM":
                if (this._currentState === deviceState.WAITING_FOR_SRM_ACK) {
                    this._lastShellAddress = undefined;
                    this.requestShell();
                    break;
                }
                this.close();
                this.unlockDevice();
                break;
            case "flash":
                if (this._currentState === deviceState.IDLE) {
                    if (await this.checkBoard(message[3])) {
                        this._currentState = deviceState.FLASH;
                        this.flash();
                    }
                }
                break;
            case "term":
                if (this._currentState === deviceState.IDLE) {
                    if (await this.checkBoard(message[3])) {
                        this._currentState = deviceState.TERM;
                        this.term({
                            baudRate: message[4]
                        } as SerialOptions);
                    }
                }
                break;
            case "input":
                if (this._currentState === deviceState.TERM) {
                    this.write(message[3]);
                }
                break;
        }
    };

    private async requestShell() {
        if (this._lastShellAddress) {
            this._shellAddress = this._lastShellAddress;
        } else {
            await vscode.commands.executeCommand('workbench.action.terminal.new');
            const processId = await vscode.window.activeTerminal?.processId;
            if (!processId) {
                vscode.window.showErrorMessage('ProcessId was undefined');
                return;
            }
            this._shellAddress = [addressTypes.SHELL, processId];
        }
        this._currentState = deviceState.WAITING_FOR_SRM_ACK;
        this.sendMessage([
            messageTypes.SRM,
            this._deviceAddress,
            this._shellAddress
        ] as outboundDeviceMessage);
    }

    private sendRequest(type: messageTypes.TERM_REQUEST | messageTypes.FLASH_REQUEST) {
        this.sendMessage([
            type,
            this._deviceAddress,
            this._shellAddress,
            this._board ? this._board.name : 'native64'
        ] as outboundDeviceMessage);
    }

    private sendLTM(receiver: shellAddress, terminationType: terminationTypes, reason: string) {
        this.sendMessage([
            messageTypes.LTM,
            this._deviceAddress,
            receiver,
            terminationType,
            reason
        ] as outboundDeviceMessage);
    };

    private async checkBoard(board: string): Promise<boolean> {
        const defaultBoard = 'native64';
        if (this._board && this._board.name !== board || !this._board && defaultBoard !== board) {
            return await vscode.window.showErrorMessage('The board used for the Term/Flash does not match the specified board.', {modal: true}, 'Continue') !== undefined;
        }
        return true;
    }

    protected startLogBundling() {
        this.stopLogBundling();
        this._logMessagesTimer = setInterval(() => {
            let out = '';
            while (this._logMessages.length !== 0) {
                out += this._logMessages.splice(0, 1)[0] + '\n';
            }
            this.sendMessage([
                messageTypes.LOG,
                this._deviceAddress,
                this._shellAddress,
                logTypes.LOG,
                out
            ] as outboundDeviceMessage);
        }, 1000);
    }

    protected stopLogBundling() {
        clearInterval(this._logMessagesTimer);
    }
}