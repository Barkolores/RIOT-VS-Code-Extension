import * as vscode from 'vscode';
import { DeviceTreeItem } from './uiDevice';
import { DeviceModel } from '../boards/device';
import { SelectedBoardTreeItem } from './uiSelBoard';
import { SelectedFolderTreeItem } from './uiSelFolder';
import { SelectedPortTreeItem } from './uiSelPort';
import { DeviceProvider } from '../../../../shared/types/deviceProvider';
import { Device } from '../../../../shared/types/device';

export class DeviceTreeItemProvider extends DeviceProvider{

    constructor(
        devices? : DeviceModel[]
    ) {
        super();
        this.devices = devices ? devices.map(
            d => new DeviceTreeItem(d, this._changeEvent)
        ) : [];
    }

        

    createDeviceTreeItem(deviceModel: DeviceModel): DeviceTreeItem {
        return new DeviceTreeItem(deviceModel, this._changeEvent);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getDeviceModels() : DeviceModel[] {
        return this.devices.map( di => (di as DeviceTreeItem).getDevice() );
    }

    createFolderTreeItem(device: Device): vscode.TreeItem {
        return new SelectedFolderTreeItem((device as DeviceTreeItem).getDevice());
    }

    createBoardTreeItem(device: Device): vscode.TreeItem {
        return new SelectedBoardTreeItem((device as DeviceTreeItem).getDevice());
    }

    createPortTreeItem(device: Device): vscode.TreeItem {
        return new SelectedPortTreeItem((device as DeviceTreeItem).getDevice());
    }

}