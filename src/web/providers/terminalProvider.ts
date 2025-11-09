import * as vscode from "vscode";

export class TerminalProvider implements vscode.WebviewViewProvider {
    constructor(private readonly basePath: vscode.Uri) {}

    private _webviewView?: vscode.WebviewView;

    postMessage(message: object): Thenable<boolean> {
        if (this._webviewView !== undefined) {
            return this._webviewView.webview.postMessage(message);
        }
        return new Promise(resolve => false);
    }

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        const cssSrc = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.basePath, 'resources', 'css', 'terminal.css'));
        webviewView.webview.options = {
            enableScripts: true,
        };
        this._webviewView = webviewView;
        webviewView.webview.html = `
        <!DOCTYPE html>
        <html lang="de">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Terminal</title>
                <link rel="stylesheet" href="${cssSrc}">
            </head>
            <body>
                <input type="text" placeholder="Input"/>
                <br/>
                <textarea id="terminal" readonly></textarea>
            </body>
            <script>
                window.addEventListener("message", (event) => {
                    console.log(event.data)
                    document.getElementById('terminal').value = event.data.message
                })
            </script>
        </html>
        `;
    }
}