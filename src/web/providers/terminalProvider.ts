import * as vscode from "vscode";
import {Device} from "../devices/device";
import {CancellationToken, WebviewView, WebviewViewResolveContext} from "vscode";

export type RiotTerminalState = 'none' | 'communication' | 'flash';

export interface RiotTerminal {
    postMessage(uuid: string, message: string): void;
    clearTerminal(): void;
}

export type TabStates = {
    [uuid: string]: {
        label: string,
        terminalState: RiotTerminalState,
        terminalData: string,
        inputData: string,
    }
}

export class TerminalProvider implements vscode.WebviewViewProvider, RiotTerminal {
    private _webviewView?: vscode.WebviewView;
    private _tabs: {
        [uuid: string]: {
            device: Device,
            terminalState: RiotTerminalState,
            terminalData: string,
            inputData: string,
        }
    } = {};
    private _selectedTab?: string;
    constructor(private readonly basePath: vscode.Uri) {}

    openTab(device: Device) {
        if (device.contextValue in this._tabs) {
            console.error('Tab for this device is already open');
            return;
        }
        this._tabs[device.contextValue] = {
            device: device,
            terminalState: 'none',
            terminalData: '',
            inputData: ''
        };
        this._webviewView?.webview.postMessage({
            action: 'openTab',
            uuid: device.contextValue,
            label: device.label
        });
        this.selectTab(device.contextValue);
        vscode.commands.executeCommand('setContext', 'riot-web-extension.context.openTabs', Object.keys(this._tabs));
    }

    async closeTab(uuid: string, closeBypass: boolean) {
        if (!(uuid in this._tabs)) {
            return;
        }
        if (!(closeBypass || await this._tabs[uuid].device.close())) {
            return;
        }
        delete this._tabs[uuid];
        if (uuid === this._selectedTab) {
            if (Object.keys(this._tabs).length === 0) {
                this.selectTab(undefined);
            } else {
                this.selectTab(Object.keys(this._tabs)[0]);
            }
        }
        this._webviewView?.webview.postMessage({
            action: 'closeTab',
            uuid: uuid
        });
        vscode.commands.executeCommand('setContext', 'riot-web-extension.context.openTabs', Object.keys(this._tabs));
    }

    selectTab(uuid: string | undefined) {
        if (uuid && !(uuid in this._tabs)) {
            return;
        }
        this._selectedTab = uuid;
        this._webviewView?.webview.postMessage({
            action: 'selectTab',
            uuid: uuid,
        });
        vscode.commands.executeCommand('setContext', 'riot-web-extension.context.terminalVisible', uuid && this._tabs[uuid].terminalState !== 'none');
    }

    private _getState(): object {
        const tabStates: TabStates = {};
        for (const [uuid, tabState] of Object.entries(this._tabs)) {
            tabStates[uuid] = {
                label: tabState.device.label as string,
                terminalState: tabState.terminalState,
                terminalData: tabState.terminalData,
                inputData: tabState.inputData
            };
        }
        return {
            tabStates: tabStates,
            selectedTab: this._selectedTab
        };
    }

    postMessage(uuid: string, message: string) {
        this._tabs[uuid].terminalData += message;
        this._webviewView?.webview.postMessage({
            action: 'message',
            uuid: uuid,
            message: message,
        });
    }

    clearTerminal() {
        if (!this._selectedTab) {
            return;
        }
        this._tabs[this._selectedTab].terminalData = '';
        this._webviewView?.webview.postMessage({
            action: 'clearTerminal'
        });
    }

    resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, token: CancellationToken): Thenable<void> | void {
        const css = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.basePath, 'resources', 'css', 'terminal.css'));
        const script = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.basePath, 'dist', 'web', 'webviews', 'terminalWebview.js'));
        webviewView.webview.options = {
            enableScripts: true,
        };
        this._webviewView = webviewView;
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.action) {
                    case 'selectTab':
                        this._selectedTab = message.selectedTab;
                        vscode.commands.executeCommand('setContext', 'riot-web-extension.context.terminalVisible', this._tabs[message.selectedTab].terminalState !== 'none');
                        break;
                    case 'requestUpdateTerminalState':
                        if (!this._selectedTab) {
                            return;
                        }
                        const hasClosed = await this._tabs[this._selectedTab].device.close();
                        if (hasClosed) {
                            if (message.newTerminalState === 'communication') {
                                const baudRate = await vscode.window.showInputBox({
                                    title: 'Choose a BaudRate',
                                    placeHolder: 'BaudRate'
                                });
                                if (!baudRate) {
                                    vscode.window.showErrorMessage('No Baudrate has been specified');
                                    return;
                                }
                                const baudRateNumber = parseInt(baudRate, 10);
                                if (Number.isNaN(baudRateNumber)) {
                                    vscode.window.showErrorMessage('The specified Baudrate could not be parsed');
                                    return;
                                }
                                await this._tabs[this._selectedTab].device.open({
                                    baudRate: baudRateNumber
                                });
                                this._tabs[this._selectedTab].device.read(this);
                            }
                            if (message.newTerminalState === 'flash') {
                                vscode.commands.executeCommand('riot-web-extension.device.flash', this._tabs[this._selectedTab].device);
                            }
                            this._tabs[this._selectedTab].terminalState = message.newTerminalState;
                            this._tabs[this._selectedTab].terminalData = '';
                            this._tabs[this._selectedTab].inputData = '';
                            this._webviewView?.webview.postMessage({
                                action: 'updateTerminalState',
                                newTerminalState: message.newTerminalState
                            });
                            vscode.commands.executeCommand('setContext', 'riot-web-extension.context.terminalVisible', this._tabs[this._selectedTab].terminalState !== 'none');
                        }
                        break;
                    case 'updateInput':
                        if (!this._selectedTab) {
                            return;
                        }
                        this._tabs[this._selectedTab].inputData = message.inputData;
                        break;
                    case "sendInput":
                        if (!this._selectedTab) {
                            return;
                        }
                        this._tabs[this._selectedTab].device.write(this._tabs[this._selectedTab].inputData);
                        break;
                    case "requestCloseTab":
                        this.closeTab(message.uuid, false);
                        break;
                    case "requestState":
                        this._webviewView?.webview.postMessage({
                            action: 'setState',
                            state: this._getState()
                        });
                        break;
                }
            },
        );
        webviewView.webview.html = this._getHTML(css, script);
    }

    private _getHTML(css: vscode.Uri, script: vscode.Uri) {
        return (`
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Riot Terminal</title>
                    <link rel="stylesheet" href="${css}">
                    <script src="${script}"></script>
                </head>
                <body data-vscode-context='{"preventDefaultContextMenuItems": true}' class="none"></body>
            </html>
        `);
    }
}