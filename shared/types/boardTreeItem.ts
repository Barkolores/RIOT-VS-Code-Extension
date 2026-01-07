import * as vscode from 'vscode';

export abstract class BoardTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        contextValue?: string,
        cmd? : vscode.Command
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        if (contextValue) {
            this.contextValue = contextValue;
        }
    }

    abstract changeBoard(boardName?: string, param?: object) : void;
}