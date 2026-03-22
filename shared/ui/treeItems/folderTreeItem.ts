import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";

export class FolderTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceTreeItem,
    ) {
        let name = 'None'
        if ('getActiveProject' in _device && typeof(_device.getActiveProject) === 'function') {
            name = (_device.getActiveProject() as vscode.WorkspaceFolder).name
        }
        super('Active Project: ' + name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'folderItem'
    }

    getParentDevice(): DeviceTreeItem {
        return this._device;
    }
}