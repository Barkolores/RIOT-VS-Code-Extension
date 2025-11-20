import * as vscode from 'vscode';

export type Command = {
    type: string,
    data: object
};

export class CommandSocket {
    private _socket: WebSocket | undefined;

    constructor(
        socketHost: string = "localhost"
    ) {
        const protocol: string = "ws";
        const port: string = "1337";
        
        if(socketHost === "") {
            vscode.window.showWarningMessage("No Host detected! CommandSocket not connected!");
            return;
        }

        const socketAdress: string = `${protocol}://${socketHost}:${port}`;
        this._socket = new WebSocket(socketAdress);
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
        console.log("CommandSocket connected.");
    }
    private onClose(): void {
        console.log("CommandSocket closed.");
    }
    private onError(error: any): void {
        console.error("CommandSocket error: ", error);
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