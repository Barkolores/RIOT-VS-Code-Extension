import * as vscode from 'vscode';
import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { BoardTypes } from '../../../../shared/ui/boardTypes';

export class RiotFileDecorationProvider implements vscode.FileDecorationProvider {
    private activeUriString: string | undefined;
    private activeBoard: BoardTypes | undefined;

    private validAppPaths: Set<string> = new Set<string>();

    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    constructor(initialPaths: string[] = []) {
        initialPaths.forEach(p => this.validAppPaths.add(p));
    }

    public removeValidPath(uri : vscode.Uri) : void {
        const uriString = uri.toString();
        if(this.validAppPaths.has(uriString)) {
            this.validAppPaths.delete(uriString);
            this._onDidChangeFileDecorations.fire(undefined);
        }
    }

    public addValidPath(uri : vscode.Uri): void {
        const uriString = uri.toString();
        if(!this.validAppPaths.has(uriString)) {
            this.validAppPaths.add(uriString);
            this._onDidChangeFileDecorations.fire(undefined);
        }
    }

    public updateActiveUri(d : DeviceModel): void {
        const uri = d.appPath;
        this.activeUriString = uri ? uri.toString() : undefined;

        this.activeBoard = d.board;
        this._onDidChangeFileDecorations.fire(undefined);
    }

    public getAllPaths(): string[] {
        return Array.from(this.validAppPaths);
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if(this.activeUriString && uri.toString() === this.activeUriString) {
            return {
                color: new vscode.ThemeColor('textLink.activeForeground'),
                badge: 'A',
                tooltip: `${this.activeBoard?.id ?? 'Unknown board'}`
            };
        }
        // else if(this.validAppPaths.has(uri.toString())) {
        //     return {
        //         color: new vscode.ThemeColor('charts.red'),
        //         badge: 'R',
        //         tooltip: `RIOT Application`
        //     };
        // }
        return undefined;
    }
}