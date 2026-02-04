import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";

export class BoardTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceTreeItem,
    ) {
        const board = _device.getBoard()
        super(`Board: ${board}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'description'
    }

    getParentDevice(): DeviceTreeItem {
        return this._device;
    }
}