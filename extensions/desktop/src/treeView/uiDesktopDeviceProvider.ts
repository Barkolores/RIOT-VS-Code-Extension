import * as vscode from 'vscode';
import { DeviceModel } from './deviceModel';
import { DeviceTreeItem } from '../../../../shared/ui/treeItems/deviceTreeItem';
import { DeviceProvider } from '../../../../shared/ui/deviceProvider';
import { DesktopDeviceTreeItem } from './uiDevice';




export class DesktopDeviceProvider extends DeviceProvider {
    protected _activeDevice : DeviceModel | undefined;

    constructor(
        devices?: DeviceModel[],
        initialActiveDevice?: DeviceModel
    ) {
        super([]);
        this._devices = devices ? devices.map(
            d => {
                return new DesktopDeviceTreeItem(d, this.onDidChangeTreeDataEventEmitter);
            }
        ) : [];
        this._activeDevice = initialActiveDevice;
    }

    getDeviceModels() : DeviceModel[] {
        return this._devices.map( di => (di as DesktopDeviceTreeItem).getDevice() );
    }

    createDeviceTreeItem(deviceModel: DeviceModel): DesktopDeviceTreeItem {
        const isActive = this._activeDevice === deviceModel;
        return new DesktopDeviceTreeItem(deviceModel, this.onDidChangeTreeDataEventEmitter, isActive);
    }
    
    getActiveDevice() : DeviceModel | undefined {
        return this._activeDevice;
    }

        setActiveDevice(device : DeviceModel | undefined) : void {
        this._activeDevice = device;

        if(this._devices) {
            this._devices.forEach( d => {
                if(d instanceof DesktopDeviceTreeItem) {
                    const isItemActive = d.getDevice() === this._activeDevice;
                    d.setActiveState(isItemActive);
                }
            });
        }
        this.refresh();
    }

}