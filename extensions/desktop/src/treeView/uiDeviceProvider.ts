import * as vscode from 'vscode';
import { DeviceTreeItem } from './uiDevice';
import { DeviceModel } from '../boards/device';
import { SelectedBoardTreeItem } from './uiSelBoard';
import { SelectedFolderTreeItem } from './uiSelFolder';
import { SelectedPortTreeItem } from './uiSelPort';
import { DeviceProvider } from '../../../../shared/types/deviceProvider';
import { Device } from '../../../../shared/types/device';

export class DeviceTreeItemProvider extends DeviceProvider{

    private activeDevice : DeviceModel | undefined;

    constructor(
        devices? : DeviceModel[]
    ) {
        super();
        this.devices = devices ? devices.map(
            d => new DeviceTreeItem(d, this._changeEvent)
        ) : [];
    }

    setActiveDevice(device : DeviceModel | undefined) : void {
        this.activeDevice = device;

        if(this.devices) {
            this.devices.forEach( d => {
                if(d instanceof DeviceTreeItem) {
                    const isItemActive = d.getDevice() === this.activeDevice;
                    d.setActiveState(isItemActive);
                }
            });
        }
        this.refresh();
    }

    getActiveDevice() : DeviceModel | undefined {
        return this.activeDevice;
    }

    createDeviceTreeItem(deviceModel: DeviceModel): DeviceTreeItem {
        const isActive = this.activeDevice === deviceModel;
        return new DeviceTreeItem(deviceModel, this._changeEvent, isActive);
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