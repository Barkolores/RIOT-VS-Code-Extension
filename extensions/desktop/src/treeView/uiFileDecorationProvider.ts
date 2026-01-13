import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';

export class RiotFileDecorationProvider implements vscode.FileDecorationProvider {
    private activeUriString: string | undefined;
    private activeBoard: string | undefined;

    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    public updateActiveUri(d : DeviceModel): void {
        const uri = d.getAppPath();
        this.activeUriString = uri ? uri.toString() : undefined;

        this.activeBoard = d.getBoardName();
        this._onDidChangeFileDecorations.fire(undefined);
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if(this.activeUriString && uri.toString() === this.activeUriString) {
            return {
                color: new vscode.ThemeColor('textLink.activeForeground'),
                badge: '●',
                tooltip: `${this.activeBoard ?? 'Unknown Board'}`,
            };
        }
        return undefined;
    }
}