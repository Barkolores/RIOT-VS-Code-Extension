import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";

export class BoardTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device?: DeviceTreeItem,
    ) {
        const board = _device?.getBoard()
        super('Selected Board: ' + (board ? board.name : 'None'), vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'boardItem'
    }

    getParentDevice(): DeviceTreeItem| undefined {
        return this._device;
    }
}