import * as vscode from "vscode";
import {SerialDevice} from "../serial";

export class TerminalProvider implements vscode.WebviewViewProvider {
    constructor(private readonly basePath: vscode.Uri) {
        this._currentTerminalState = TerminalState.NONE;
    }

    private _webviewView?: vscode.WebviewView;

    private _device?: SerialDevice;

    private _currentTerminalState: TerminalState;

    setDevice(device?: SerialDevice) {
        this._device = device;
    }

    postMessage(message: string) {
        if (this._webviewView !== undefined) {
            this._webviewView.webview.postMessage({
                action: 'message',
                message: message
            });
        }
    }

    clearTerminal() {
        if (this._webviewView !== undefined) {
            this._webviewView.webview.postMessage({
                action: 'clearTerminal'
            });
        }
    }

    setTerminalState(newTerminalState: TerminalState) {
        this._currentTerminalState = newTerminalState;
        if (this._webviewView !== undefined) {
            this._webviewView.webview.postMessage({
                action: 'updateTerminal',
                newTerminalState: newTerminalState
            });
            this.clearTerminal();
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        const cssSrc = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.basePath, 'resources', 'css', 'terminal.css'));
        webviewView.webview.options = {
            enableScripts: true,
        };
        this._webviewView = webviewView;

        webviewView.webview.onDidReceiveMessage(
            message => {
                if (this._device === undefined) {
                    return;
                }
                this._device.write(message.value);
            },
        );

        webviewView.webview.html = `
        <!DOCTYPE html>
        <html lang="de">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Terminal</title>
                <link rel="stylesheet" href="${cssSrc}">
            </head>
            <body data-vscode-context='{"preventDefaultContextMenuItems": true}' class="${this._currentTerminalState}">
                <div class="inputArea" id="inputArea">
                     <button onclick="sendInput()">Send Input</button>
                     <input type="text" placeholder="Input" id="input"/>
                </div>
                <br/>
                <textarea id="terminal" readonly></textarea>
                <p class="welcome">No Serial Device open</p>
            </body>
            <script>
                const vscode = acquireVsCodeApi();
                const terminal = document.getElementById('terminal')
                const input = document.getElementById('input')
                window.addEventListener("message", (event) => {
                    switch (event.data.action) {
                        case "updateTerminal":
                            document.body.className = event.data.newTerminalState
                            break;
                        case "clearTerminal":
                            terminal.value = ''
                            input.value = ''
                            break;
                        case "message":
                            terminal.value += event.data.message
                            break;
                    }
                })
                function sendInput() {
                    vscode.postMessage({
                        value: input.value
                    })
                }
            </script>
        </html>
        `;
    }
}

export enum TerminalState {
    NONE= "none",
    COMMUNICATION = "communication",
    FLASH = "flash"
}