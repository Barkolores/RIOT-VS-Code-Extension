import * as vscode from 'vscode';

export type Command = {
    type: string,
    data: object
};

export class CommandSocket {
    private readonly _socket: WebSocket | undefined;
    private readonly _port: number = 3001;

    constructor(
        protocol: string,
        host: string,
    ) {
        if (host === '') {
            vscode.window.showErrorMessage("No Host detected! CommandSocket not connected!");
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
                vscode.window.showErrorMessage("No Protocol detected! CommandSocket not connected!");
                return;
        }
        this._socket = new WebSocket(url);
        this._socket.onopen = this.onOpen;
        this._socket.onclose = this.onClose;
        this._socket.onerror = this.onError;
        this._socket.onmessage = (event) => {
            try {
                const command: Command = JSON.parse(event.data) as Command;
                this.onCommand(command);
            } catch (e) {
                this.onError("Invalid Message: " + event.data);
            }
        };
    }

    public close(): void {
        if(this._socket !== undefined) {
            this._socket.close();
        }
    }

    private onOpen(): void {
        vscode.commands.executeCommand('setContext', 'riot-web-extension.context.websocketOpen', true);
        console.log("CommandSocket connected.");
    }
    private onClose(): void {
        vscode.commands.executeCommand('setContext', 'riot-web-extension.context.websocketOpen', false);
        console.log("CommandSocket closed.");
    }
    private onError(error: any): void {
        console.error("CommandSocket error: ", error);
        vscode.commands.executeCommand('riot-web-extension.websocket.close');
    }
    private onCommand(command: Command): void {
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