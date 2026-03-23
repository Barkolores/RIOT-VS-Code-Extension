import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";
import path from 'path';
import { DesktopDeviceTreeItem } from '../../../extensions/desktop/src/treeView/uiDevice';

export class FolderTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceTreeItem,
    ) {
        let label = 'None';
        let tooltipText: string | undefined = undefined;

        if ('getActiveProject' in _device && typeof(_device.getActiveProject) === 'function') {
            label = 'Active Project: ' + (_device.getActiveProject() as vscode.WorkspaceFolder).name;
        } else {
            const desktopDevice = _device as DesktopDeviceTreeItem;
            const appUri = desktopDevice.getDevice().appPath;
            label = `Project: ${appUri ? path.basename(appUri.fsPath) : 'Unknown application path'} `;       
            tooltipText = appUri ? appUri.fsPath : "No application path set";
        }

        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = tooltipText;
        this.contextValue = 'folderItem';
    }

    getParentDevice(): DeviceTreeItem {
        return this._device;
    }
    
}