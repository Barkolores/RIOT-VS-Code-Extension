import * as vscode from 'vscode';
import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { BoardTypes } from '../../../../shared/ui/boardTypes';

export class RiotFileDecorationProvider implements vscode.FileDecorationProvider {
    private activeUriString: string | undefined;
    private activeBoard: BoardTypes | undefined;

    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    public updateActiveUri(d : DeviceModel): void {
        const uri = d.appPath;
        this.activeUriString = uri ? uri.toString() : undefined;

        this.activeBoard = d.board;
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