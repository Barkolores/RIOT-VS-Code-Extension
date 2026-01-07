import * as vscode from 'vscode';


//TODO: Adapt this class to workspace folders instead of string for paths
export abstract class FolderTreeItem extends vscode.TreeItem {
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

    abstract changeDirectory(param?: object) : void;
}