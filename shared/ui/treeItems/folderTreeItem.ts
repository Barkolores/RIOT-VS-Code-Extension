import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";
import { DeviceModel } from '../deviceModel';
import { BoardTypes } from '../boardTypes';
import path from 'path';

export class FolderTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceModel,
    ) {
        const appUri = _device.appPath;
        const labelStr = `${appUri ? path.basename(appUri.fsPath) : 'Unknown application path'} `;       
        super(labelStr, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'folderItem'
    }

    getDevice(): DeviceModel {
        return this._device;
    }

    getBoard(): BoardTypes | undefined {
        return this._device.board;
    }

    setAppPath(appPath : vscode.Uri) : void {
        this._device.appPath = appPath;
    }

    setBasePath(riotBasePath : vscode.Uri) : void {
        this._device.riotBasePath = riotBasePath;
    }

    changeDirectory(param?: object): void {
        if(param && typeof param === 'string') {
            this._device.appPath = param;
        }
    }
    
}