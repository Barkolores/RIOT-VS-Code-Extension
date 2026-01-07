import * as vscode from 'vscode';

export abstract class PortTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        contextValue?: string,
        cmd? : vscode.Command
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        if (contextValue) {
            this.contextValue = contextValue;
        }
        if (cmd) {
            this.command = cmd;
        }
    }

    abstract changePort(portPath?: string, param?: object) : void;
}