import * as vscode from 'vscode';
import { DesktopDeviceTreeItem } from './uiDevice';
import { DeviceModel } from '../boards/device';
import { SelectedBoardTreeItem } from './uiSelBoard';
import { SelectedFolderTreeItem } from './uiSelFolder';
import { SelectedPortTreeItem } from './uiSelPort';
import { DeviceProvider } from '../../../../shared/ui/deviceProvider';
import { DeviceTreeItem } from '../../../../shared/ui/treeItems/deviceTreeItem';
import { DescriptionHeaderTreeItem } from '../../../../shared/ui/treeItems/descriptionHeaderTreeItem';
import { DescriptionTreeItem } from '../../../../shared/ui/treeItems/descriptionTreeItem';

export class DeviceTreeItemProvider extends DeviceProvider{

    private activeDevice : DeviceModel | undefined;

    constructor(
        devices? : DeviceModel[]
    ) {
        super();
        this._devices = devices ? devices.map(
            d => new DesktopDeviceTreeItem(d, this.onDidChangeTreeDataEventEmitter)
        ) : [];
    }

    // Temporarily overwrites parent's method
    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            return this._devices;
        } else {
            let items: vscode.TreeItem[] = [];
            if (element instanceof DeviceTreeItem) {
                //Device subtree
                const device = element as DeviceTreeItem;
                items.push(
                    this.createBoardTreeItem(device),
                    this.createFolderTreeItem(device),
                    this.createPortTreeItem(device)
                );
                // if (device.getPort() !== undefined) {
                //     items.push(
                //         new PortTreeItem(device)
                //     );
                // }
                if (device.getDescription() !== undefined) {
                    items.push(
                        new DescriptionHeaderTreeItem(device)
                    );
                }
            } else {
                // Description subtree
                const description = (element as DescriptionHeaderTreeItem).getParentDevice().getDescription();
                if (description) {
                    for (const label of description) {
                        items.push(
                            new DescriptionTreeItem(label)
                        );
                    }
                }
            }
            return items;
        }
    }



    setActiveDevice(device : DeviceModel | undefined) : void {
        this.activeDevice = device;

        if(this._devices) {
            this._devices.forEach( d => {
                if(d instanceof DesktopDeviceTreeItem) {
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

    createDeviceTreeItem(deviceModel: DeviceModel): DesktopDeviceTreeItem {
        const isActive = this.activeDevice === deviceModel;
        return new DesktopDeviceTreeItem(deviceModel, this.onDidChangeTreeDataEventEmitter, isActive);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getDeviceModels() : DeviceModel[] {
        return this._devices.map( di => (di as DesktopDeviceTreeItem).getDevice() );
    }

    createFolderTreeItem(device: DeviceTreeItem): vscode.TreeItem {
        return new SelectedFolderTreeItem((device as DesktopDeviceTreeItem).getDevice());
    }

    createBoardTreeItem(device: DeviceTreeItem): vscode.TreeItem {
        return new SelectedBoardTreeItem((device as DesktopDeviceTreeItem).getDevice());
    }

    createPortTreeItem(device: DeviceTreeItem): vscode.TreeItem {
        return new SelectedPortTreeItem((device as DesktopDeviceTreeItem).getDevice());
    }

}