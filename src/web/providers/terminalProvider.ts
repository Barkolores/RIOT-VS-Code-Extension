import * as vscode from "vscode";
import {Device} from "../devices/device";

export class TerminalProvider implements vscode.WebviewViewProvider, RiotTerminal {
    constructor(private readonly basePath: vscode.Uri) {}

    private _webviewView?: vscode.WebviewView;

    private _devices: Device[] = [];

    private _webviewState: {devices: {uuid: string, label: string, terminalState: RiotTerminalState, terminalData: string, inputData: string}[], selectedTab?: string} = {
        devices: [],
        selectedTab: '',
    };

    addDevice(device: Device, terminalState: RiotTerminalState) {
        const index = this._devices.indexOf(device);
        if (index === -1) {
            this._devices.push(device);
            this._webviewView?.webview.postMessage({
                action: 'addDevice',
                uuid: device.contextValue,
                label: device.label,
                terminalState: terminalState,
                terminalData: "",
                inputData: ""
            });
            this._webviewState.devices.push({
                uuid: device.contextValue,
                label: device.label as string,
                terminalState: terminalState,
                terminalData: "",
                inputData: ""
            });
        } else {
            this._webviewView?.webview.postMessage({
                action: 'updateDevice',
                uuid: device.contextValue,
                terminalState: terminalState,
            });
            for (let i = 0; i < this._webviewState.devices.length; i++) {
                if (this._webviewState.devices[i].uuid === device.contextValue) {
                    this._webviewState.devices[i] = {
                        ...this._webviewState.devices[i],
                        terminalState: terminalState,
                        terminalData: "",
                        inputData: "",
                    };
                    break;
                }
            }
        }
    }

    removeDevice(device: Device) {
        const index = this._devices.indexOf(device);
        if (index !== -1) {
            this._devices.splice(index, 1);
            this._webviewView?.webview.postMessage({
                action: 'removeDevice',
                uuid: device.contextValue,
            });
            for (let i = 0; i < this._webviewState.devices.length; i++) {
                if (this._webviewState.devices[i].uuid === device.contextValue) {
                    this._webviewState.devices.splice(i, 1);
                    break;
                }
            }
            if (device.contextValue === this._webviewState.selectedTab) {
                if (this._devices.length === 0) {
                    this._webviewState.selectedTab = undefined;
                } else {
                    this._webviewState.selectedTab = this._devices[0].contextValue;
                }
            }
        }
    }

    postMessage(uuid: string, message: string) {
        if (this._webviewView !== undefined) {
            this._webviewView.webview.postMessage({
                action: 'message',
                uuid: uuid,
                message: message
            });
            for (const device of this._webviewState.devices) {
                if (device.uuid === this._webviewState.selectedTab) {
                    device.terminalData += message;
                }
            }
        }
    }

    clearTerminal() {
        if (this._webviewView !== undefined) {
            this._webviewView.webview.postMessage({
                action: 'clearTerminal'
            });
            for (const device of this._webviewState.devices) {
                if (device.uuid === this._webviewState.selectedTab) {
                    device.terminalData = '';
                }
            }
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        const css = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.basePath, 'resources', 'css', 'terminal.css'));
        const script = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.basePath, 'dist', 'web', 'webviews', 'terminalWebview.js'));
        webviewView.webview.options = {
            enableScripts: true,
        };
        this._webviewView = webviewView;
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.action) {
                    case 'selectTab':
                        this._webviewState.selectedTab = message.tab;
                        break;
                    case 'message': {
                        for (const device of this._devices) {
                            if (device.contextValue === message.uuid) {
                                device.write(message.message);
                                break;
                            }
                        }
                        break;
                    }
                    case "updateInput":
                        for (const device of this._webviewState.devices) {
                            if (device.uuid === message.uuid) {
                                device.inputData = message.input;
                                break;
                            }
                        }
                        break;
                }
            },
        );
        webviewView.webview.html = getHTML(css, script, JSON.stringify(this._webviewState));
    }
}

export enum RiotTerminalState {
    COMMUNICATION = "communication",
    FLASH = "flash"
}

export interface RiotTerminal {
    postMessage(uuid: string, message: string): void;
    clearTerminal(): void;
}

function getHTML(css: vscode.Uri, script: vscode.Uri, webviewState: string) {
    return (`
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Riot Terminal</title>
        <link rel="stylesheet" href="${css}">
        <script src="${script}" id="script" data-json='${webviewState}'></script>
    </head>
    <body data-vscode-context='{"preventDefaultContextMenuItems": true}' class="none"></body>
</html>
`);
}