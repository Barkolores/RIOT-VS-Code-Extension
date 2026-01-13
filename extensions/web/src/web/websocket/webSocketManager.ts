import * as vscode from 'vscode';
import {Command} from "./command";
import {WebDevice} from "../devices/webDevice";

export class WebSocketManager {
    private readonly _url: string | undefined;
    private _socket: WebSocket | undefined;
    private readonly _port: number = 7777;

    constructor() {
        const parsed_expression = /^(.*?):.*\.([^;]*?)[:|\/]/.exec(location.pathname);
        if (!parsed_expression) {
            vscode.window.showErrorMessage('URL could not be parsed! Websocket cannot be connected!');
            return;
        }
        const protocol = parsed_expression[1];
        const host = parsed_expression[2];
        if (host === '') {
            vscode.window.showErrorMessage("No host detected! Websocket cannot be connected!");
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
                vscode.window.showErrorMessage("Protocol " + protocol + " isn't supported! Websocket cannot be connected!");
                return;
        }
        this._url = url;
    }

    public open(): void {
        if (this._url === undefined) {
            throw new Error("Websocket cannot be opened due to invalid url.");
        }
        this._socket = new WebSocket(this._url);

        //onOpen
        this._socket.onopen = () => {
            console.log("Websocket connected.");
            vscode.commands.executeCommand('setContext', 'riot-web-extension.context.websocketOpen', true);
        };

        //onClose
        this._socket.onclose = () => {
            console.error("Websocket closed. Connection reset in 5 seconds.");
            vscode.commands.executeCommand('setContext', 'riot-web-extension.context.websocketOpen', false);
        };

        //onError
        this._socket.onerror = (error: any) => {
            console.error("Websocket error: ", error);
            vscode.window.showErrorMessage("Websocket Error");
        };

        //onMessage
        this._socket.onmessage = (event) => {
            try {
                const command: Command = JSON.parse(event.data) as Command;
                this.onMessage(command);
            } catch (e) {
                vscode.window.showErrorMessage("Received invalid message from Websocket Server: " + event.data);
            }
        };
    }

    public close(): void {
        this._socket?.close();
    }

    public isOpen(): boolean {
        return this._socket !== undefined && this._socket.readyState === this._socket.OPEN;
    }

    private sendMessage(command: Command) {
        this._socket?.send(JSON.stringify(command));
    }

    public makeTerm(device: WebDevice) {

    }

    public flash(device: WebDevice) {

    }

    public postMessage(message: string) {

    }

    private onMessage(command: Command): void {
        switch(command.type) {
            case("flash"):
                this.onFlashCommand(command.data);
                break;
            case("term"):
                this.onTermCommand(command.data);
                break;
        }
    }

    private onFlashCommand(command: object) {
        
    }

    private onTermCommand(command: object) {
        
    }
}