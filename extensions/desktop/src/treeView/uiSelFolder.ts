import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';
import { FolderTreeItem } from '../../../../shared/types/folderTreeItem';

export class SelectedFolderTreeItem extends FolderTreeItem{
    public constructor (
        private device : DeviceModel
    ) {
        const labelStr = `${device.getAppPath() ?? 'Unknown application path'} `;
        super(labelStr, 'riot-device-folder');
        this.command = {
            command: 'riot-launcher.changeFolderDevice',
            title: 'Change Folder',
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

    setBasePath(riotBasePath : string) : void {
        this.device.setRiotBasePath(riotBasePath);
    }

    changeDirectory(param?: object): void {
        if(param && typeof param === 'string') {
            this.device.setAppPath(param);
        }
    }
}