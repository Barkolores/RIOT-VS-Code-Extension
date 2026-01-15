import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";

export class DescriptionHeaderTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceTreeItem,
    ) {
        super('Additional Information', vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'descriptionItem'
    }

    getParentDevice(): DeviceTreeItem {
        return this._device;
    }
}