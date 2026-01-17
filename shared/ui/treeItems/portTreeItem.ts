import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";

export class PortTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device?: DeviceTreeItem,
    ) {
        const port = _device?.getPort();
        super('Selected Port: ' + port, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'portItem'
    }

    getParentDevice(): DeviceTreeItem | undefined{
        return this._device;
    }
}