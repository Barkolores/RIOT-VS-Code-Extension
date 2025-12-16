import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';

export class SelectedFolderTreeItem extends vscode.TreeItem{

    public constructor (
        private device : DeviceModel
    ) {
        const labelStr = `${device.getBoardName() ?? 'Unknown board'} `;
        super(labelStr, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'riot-device-folder';
    }

}