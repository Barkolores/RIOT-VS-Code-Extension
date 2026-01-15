import * as vscode from 'vscode';

export class DescriptionTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'descriptionItem'
    }
}