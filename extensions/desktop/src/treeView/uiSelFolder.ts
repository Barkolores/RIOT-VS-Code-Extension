    import * as vscode from 'vscode';
    import { DeviceModel } from '../boards/device';
    import { FolderTreeItem } from '../../../../shared/types/folderTreeItem';
    import path from 'path';

    export class SelectedFolderTreeItem extends FolderTreeItem{
        
        public constructor (
            private device : DeviceModel
        ) {
            const appUri = device.getAppPath();
            const labelStr = `${appUri ? path.basename(appUri.fsPath) : 'Unknown application path'} `;
            super(labelStr, 'riot-device-folder');
            this.command = {
                command: 'riot-launcher.changeFolderDevice',
                title: 'Change Folder',
                arguments: [this]
            };
            if(appUri) {
                this.tooltip = appUri.fsPath;
            }

        }

        getBoard(): string | undefined {
            return this.device.getBoardName();
        }

        getDevice() : DeviceModel {
            return this.device;
        }

        setAppPath(appPath : vscode.Uri) : void {
            this.device.setAppPath(appPath);
        }

        setBasePath(riotBasePath : vscode.Uri) : void {
            this.device.setRiotBasePath(riotBasePath);
        }

        changeDirectory(param?: object): void {
            if(param && typeof param === 'string') {
                this.device.setAppPath(param);
            }
        }
    }