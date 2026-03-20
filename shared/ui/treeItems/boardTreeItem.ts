import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";

export class BoardTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceTreeItem,
    ) {
        const board = _device.getBoard()
        super(`Board: ${board ? board : 'Not specified'}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'descriptionItem'
    }

    getParentDevice(): DeviceTreeItem {
        return this._device;
    }
}