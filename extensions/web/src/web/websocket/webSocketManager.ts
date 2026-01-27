import * as vscode from 'vscode';
import {DeviceManager} from "../devices/deviceManager";
import {outboundWSMessage} from "./api/outbound/outboundWSMessage";
import {decode, encode} from 'cbor-x';
import {addressTypes, clientAddress, messageTypes} from "./api/additionalTypes";
import {isValidInboundMessage} from "./api/inbound/inboundWSMessage.guard";
import {inboundWSMessage} from "./api/inbound/inboundWSMessage";
import {isValidOutboundMessage} from "./api/outbound/outboundWSMessage.guard";

export class WebSocketManager {
    private _url: string | undefined;
    private _socket: WebSocket | undefined;
    private readonly _port: number = 7777;
    private _wsConnectionTimeout: NodeJS.Timeout | undefined = undefined;
    private _apiConnected: boolean = false;
    private _apiConnectInterval: NodeJS.Timeout | undefined = undefined;

    constructor(
        private _deviceManager: DeviceManager,
        private _messagePort: MessagePort,
        private _testPort: MessagePort,
    ) {
        const parsed_expression = /^(.*?):.*\.([^;]*?)[:|\/]/.exec(location.pathname);
        if (!parsed_expression) {
            vscode.window.showErrorMessage('URL could not be parsed! Websocket cannot be connected! Please specify the Websocket URL manually.');
            return;
        }
        const protocol = parsed_expression[1];
        const host = parsed_expression[2];
        if (host === '') {
            vscode.window.showErrorMessage("No host detected! Websocket cannot be connected! Please specify the Websocket URL manually.");
            return;
        }
        let url = '://' + host + ':' + this._port;
        switch (protocol) {
            case 'http':
                url = 'ws' + url;
                break;
            case 'https':
                url = 'wss' + url;
                break;
            default:
                vscode.window.showErrorMessage("Protocol " + protocol + " isn't supported! Websocket cannot be connected! Please specify the Websocket URL manually.");
                return;
        }
        this._url = url;
    }

    public isReady(): boolean {
        //TESTING
        //bypassed for debug
        // return this._socket !== undefined && this._socket.readyState === this._socket.OPEN && this._apiConnected;
        return true;
    }

    public open(): void {
        if (this._url === undefined) {
            vscode.window.showErrorMessage("Websocket cannot be connected due to invalid URL! Please specify the Websocket URL manually.");
            return;
        }
        console.log('Opening Websocket to URL:', this._url);

        clearTimeout(this._wsConnectionTimeout);
        this._socket = new WebSocket(this._url);

        this._socket.onopen = this.onOpen.bind(this);
        this._socket.onclose = this.onClose.bind(this);
        this._socket.onerror = this.onError.bind(this);
        this._socket.onmessage = this.onMessage.bind(this);
        //for testing only
        this._testPort.onmessage = this.onMessage.bind(this);
        this._messagePort.onmessage = (event) => {
            const message = event.data;
            //Debug
            if (isValidOutboundMessage(message)) {
                this.sendMessage(message);
            } else {
                vscode.window.showErrorMessage('Invalid outbound message');
                console.log(message);
            }
        };
    }

    public close(): void {
        this._messagePort.onmessage = () => {};
        this._testPort.onmessage = () => {};
        this._socket?.close();
        this._socket = undefined;
    }

    private onOpen() {
        vscode.window.showInformationMessage('Websocket connected.');
        console.log("Websocket connected.");
        this.startApiConnectInterval();
    }

    private onClose() {
        this._socket = undefined;
        this._apiConnected = false;
        this._deviceManager.cancelAllDeviceActions();
        vscode.commands.executeCommand('setContext', 'riot-web-extension.context.connectionEstablished', false);
        this.clearApiConnectInterval();
        vscode.window.showErrorMessage("Websocket closed. Connection reset in 10 seconds.");
        //TESTING
        //disabled for debug
        // this._wsConnectionTimeout = setTimeout(this.open.bind(this), 10000);
    }

    private onError(error: Event) {
        vscode.window.showErrorMessage("Websocket Error");
        console.log(error);
    }

    private onMessage(event: MessageEvent<any>) {
        try {
            const parsedData = decode(event.data);
            if (isValidInboundMessage(parsedData)) {
                this.handleMessage(parsedData);
            } else {
                vscode.window.showErrorMessage('Parsed message is not supported');
                console.log(parsedData);
            }
        } catch (e) {
            vscode.window.showErrorMessage('Received invalid message from Websocket Server');
            console.log(e);
        }
    }

    private handleMessage(message: inboundWSMessage) {
        console.log('Received inbound message:', message);
        switch (message[0]) {
            case messageTypes.CONNECT_ACK:
                this._apiConnected = true;
                vscode.commands.executeCommand('setContext', 'riot-web-extension.context.connectionEstablished', true);
                vscode.window.showInformationMessage('Connection fully established.');
                console.log('Connection fully established.');
                this.clearApiConnectInterval();
                break;
            case messageTypes.DISCONNECT:
                this._apiConnected = false;
                this._deviceManager.cancelAllDeviceActions();
                vscode.commands.executeCommand('setContext', 'riot-web-extension.context.connectionEstablished', false);
                vscode.window.showErrorMessage('Received Disconnect Message, reestablishing connection in 10 seconds...');
                setTimeout(this.startApiConnectInterval.bind(this), 10000);
                break;
            default:
                if (this._apiConnected) {
                    this._deviceManager.handleMessage(message);
                } else {
                    vscode.window.showErrorMessage('No messages directed at devices should be received until the connection to the Websocket Server has been fully established.');
                }
                break;
        }
    }

    private sendMessage(message: outboundWSMessage) {
        this._socket?.send(encode(message));
        console.log('Send outbound message:', message);
    }

    private sendConnectMessage() {
        this.sendMessage([
            messageTypes.CONNECT,
            [addressTypes.CLIENT, 0] as clientAddress
        ] as outboundWSMessage);
    }

    private startApiConnectInterval() {
        this.clearApiConnectInterval();
        //retry connect Message every 10 seconds if no response
        this.sendConnectMessage();
        this._apiConnectInterval = setInterval(() => {
            console.log('Received no Connection Acknowledgment in the past 10 seconds, retrying...');
            vscode.window.showErrorMessage('Received no Connection Acknowledgment in the past 10 seconds, retrying...');
            this.sendConnectMessage();
        }, 10000);
    }

    private clearApiConnectInterval() {
        clearInterval(this._apiConnectInterval);
    }

    getURL() {
        return this._url;
    }

    setURL(newURL: string) {
        this._url = newURL;
        if (this._socket) {
            this._socket.onopen = () => {};
            this._socket.onclose = () => {};
            this._socket.onerror = () => {};
            this._socket.onmessage = () => {};
        }
        this.close();
        this.open();
        vscode.window.showInformationMessage('URL has been changed. Reestablishing Websocket Connection');
    }
}