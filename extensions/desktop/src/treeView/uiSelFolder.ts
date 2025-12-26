import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';

export class SelectedFolderTreeItem extends vscode.TreeItem{

    public constructor (
        private device : DeviceModel
    ) {
        const labelStr = `${device.getAppPath() ?? 'Unknown application path'} `;
        super(labelStr, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'riot-device-folder';
        this.command = {
            command: 'riot-launcher.changeFolderDevice',
            title: 'Change Port',
            arguments: [this]
        };

    }

    getBoard(): string | undefined {
        return this.device.getBoardName();
    }

    getDevice() : DeviceModel {
        return this.device;
    }

    setAppPath(appPath : string) : void {
        this.device.setAppPath(appPath);
    }

}