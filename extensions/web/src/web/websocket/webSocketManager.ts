import * as vscode from 'vscode';
import {DeviceManager} from "../devices/deviceManager";
import {outboundWSMessage} from "./api/outbound/outboundWSMessage";
import {decode, encode} from 'cbor-x';
import {addressTypes, clientAddress, messageTypes, shellAddress, terminationTypes} from "./api/additionalTypes";
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
    private static _localHosts: string[] = ['localhost', '127.0.0.1'];

    constructor(
        private _deviceManager: DeviceManager,
        private _messagePort: MessagePort,
        extensionUri: vscode.Uri,
    ) {
        const parsed_expression = /^[^:]+/.exec(extensionUri.authority);
        if (!parsed_expression) {
            vscode.window.showErrorMessage('URL could not be parsed! Websocket cannot be connected! Please specify the Websocket URL manually.');
            return;
        }
        const host = parsed_expression[0];
        if (host === '' || host === undefined) {
            vscode.window.showErrorMessage("No host detected! Websocket cannot be connected! Please specify the Websocket URL manually.");
            return;
        }
        let url = '://' + host + ':' + this._port;
        this._url = 'ws' + (!WebSocketManager._localHosts.includes(host) ? 's' : '') + url;
    }

    public isReady(): boolean {
        return this._socket !== undefined && this._socket.readyState === this._socket.OPEN && this._apiConnected;
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
        this._messagePort.onmessage = (event) => {
            const message = event.data;
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
        this._wsConnectionTimeout = setTimeout(this.open.bind(this), 10000);
    }

    private onError(error: Event) {
        vscode.window.showErrorMessage("Websocket Error");
        console.log(error);
    }

    private async onMessage(event: MessageEvent<any>) {
        try {
            let parsedData;
            if (event.data instanceof Blob) {
                parsedData = decode(new Uint8Array(await event.data.arrayBuffer()));
            } else {
                parsedData = decode(event.data);
            }
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
                this.terminalCleanup();
                break;
            case messageTypes.DISCONNECT:
                this.resetApi();
                vscode.window.showErrorMessage('Received Disconnect Message, reestablishing connection in 10 seconds...');
                this._apiConnectInterval = setTimeout(this.startApiConnectInterval.bind(this), 10000);
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
            vscode.window.showErrorMessage('Received no Connection Acknowledgment in the past 10 seconds, retrying...');
            this.sendConnectMessage();
        }, 10000);
    }

    private clearApiConnectInterval() {
        clearInterval(this._apiConnectInterval);
    }

    private resetApi() {
        this._apiConnected = false;
        this._deviceManager.cancelAllDeviceActions();
        this.clearApiConnectInterval();
        vscode.commands.executeCommand('setContext', 'riot-web-extension.context.connectionEstablished', false);
    }

    getURL() {
        return this._url;
    }

    setURL(newURL: string) {
        this.resetApi();
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

    async terminalCleanup() {
        //Terminal Cleanup on Startup
        for (const terminal of vscode.window.terminals) {
            const id = await terminal.processId;
            if (id) {
                this.sendMessage([
                    messageTypes.RST,
                    ['client', 0] as clientAddress,
                    ['shell', id] as shellAddress,
                    terminationTypes.ERROR,
                    'Extension initialization'
                ]);
            }
        }
    }
}