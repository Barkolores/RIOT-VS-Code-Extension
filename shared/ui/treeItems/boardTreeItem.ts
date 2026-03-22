import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";
import { DeviceModel } from '../../../extensions/desktop/src/treeView/deviceModel';

export class BoardTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceTreeItem,
    ) {
        const board = _device.getBoard()
        super(`Board: ${board ? board : 'Not specified'}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'boardItem'
    }

    getParentDevice(): DeviceTreeItem {
        return this._device;
    }

}