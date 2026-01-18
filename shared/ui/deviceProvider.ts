import * as vscode from 'vscode';
import { DeviceTreeItem } from './treeItems/deviceTreeItem';
import {FolderTreeItem} from "./treeItems/folderTreeItem";
import {PortTreeItem} from "./treeItems/portTreeItem";
import {BoardTreeItem} from "./treeItems/boardTreeItem";
import {DescriptionTreeItem} from "./treeItems/descriptionTreeItem";
import {DescriptionHeaderTreeItem} from "./treeItems/descriptionHeaderTreeItem";
import { DeviceModel } from './deviceModel';
import { DesktopDeviceTreeItem } from '../../extensions/desktop/src/treeView/uiDevice';

export class DeviceProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    protected _devices : DeviceTreeItem[];
    protected _activeDevice : DeviceModel | undefined;

    readonly onDidChangeTreeDataEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined> = new vscode.EventEmitter<DeviceTreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;

    constructor(
        devices? : DeviceModel[],
        initialActiveDevice? : DeviceModel
    ) {
        this._devices = devices ? devices.map(
            d => {
                return new DesktopDeviceTreeItem(d, this.onDidChangeTreeDataEventEmitter)
            }
        ) : [];
    }

    getDeviceModels() : DeviceModel[] {
        return this._devices.map( di => (di as DesktopDeviceTreeItem).getDevice() );
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            return this._devices;
        } else {
            let items: vscode.TreeItem[] = [];
            if (element instanceof DeviceTreeItem) {
                //Device subtree
                const device = element as DeviceTreeItem;
                items.push(
                    new FolderTreeItem(device.getDevice()),
                    new BoardTreeItem(device.getDevice()),
                )
                // if (device.getPort() !== undefined) {
                items.push(
                    new PortTreeItem(device.getDevice())
                )
                // }
                if (device.getDescription() !== undefined) {
                    items.push(
                        new DescriptionHeaderTreeItem(device)
                    )
                }
            } else {
                //Description subtree
                const description = (element as DescriptionHeaderTreeItem).getParentDevice().getDescription();
                if (description) {
                    for (const label of description) {
                        items.push(
                            new DescriptionTreeItem(label)
                        )
                    }
                }
            }
            return items;
        }
    }

    createDeviceTreeItem(deviceModel: DeviceModel): DesktopDeviceTreeItem {
        const isActive = this._activeDevice === deviceModel;
        return new DesktopDeviceTreeItem(deviceModel, this.onDidChangeTreeDataEventEmitter, isActive);
    }
    
    getActiveDevice() : DeviceModel | undefined {
        return this._activeDevice;
    }
    

    refresh(): void {
        this.onDidChangeTreeDataEventEmitter.fire(undefined);
    }

    setDevices(devices: DeviceTreeItem[]): void {
        this._devices = devices;
    }

    public addDevice (device : DeviceTreeItem) : void {
        this._devices.push(device);
        this.refresh();
    }

    public removeDevice (device : DeviceTreeItem) : void {
        this._devices = this._devices.filter(d => d !== device);
        this.refresh();
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