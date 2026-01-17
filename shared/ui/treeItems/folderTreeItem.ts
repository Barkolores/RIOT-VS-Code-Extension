import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";

export class FolderTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device?: DeviceTreeItem,

    ) {
        const project = _device?.getActiveProject();
        super('Active Project: ' + (project ? project.name : 'None'), vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'folderItem'
    }

    getParentDevice(): DeviceTreeItem | undefined{
        return this._device;
    }
}