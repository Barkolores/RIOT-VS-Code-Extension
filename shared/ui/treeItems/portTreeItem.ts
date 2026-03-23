import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";
import { DeviceModel } from '../../../extensions/desktop/src/treeView/deviceModel';

export class PortTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceTreeItem
    ) {
        const port = _device.getPort();
        super('Port: ' + (port ?? 'None'), vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'portItem'
    }

    getParentDevice(): DeviceTreeItem {
        return this._device;
    }

}