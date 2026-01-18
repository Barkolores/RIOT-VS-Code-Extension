import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";
import { DeviceModel } from '../deviceModel';

export class PortTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceModel
    ) {
        const port = _device.portPath;
        const labelStr = `${_device.portPath ?? 'Port: None'} `;

        super(labelStr, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'portItem'
    }

    getDevice(): DeviceModel {
        return this._device;
    }

    changePortPath(portPath : string) : void {
        this._device.portPath = portPath === 'None' ? undefined : portPath;
    }

}