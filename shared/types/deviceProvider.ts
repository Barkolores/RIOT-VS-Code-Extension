import * as vscode from 'vscode';
import { Device } from './device';

export abstract class DeviceProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    protected _changeEvent: vscode.EventEmitter<Device | undefined> = new vscode.EventEmitter<Device| undefined>();
    readonly onDidChangeTreeData = this._changeEvent.event;
    protected devices : Device[];

    constructor(
        devices? : Device[]
    ) {
        this.devices = devices ?? [];
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            return this.devices;
        } else {
            return [
                this.createBoardTreeItem(element as Device),
                this.createPortTreeItem(element as Device),
                this.createFolderTreeItem(element as Device)
            ];
        }
    }


    public addDevice (device : Device) : void {
        this.devices.push(device);
        this.refresh();
    }

    public removeDevice (device : Device) : void {
        this.devices = this.devices.filter(d => d !== device);
        this.refresh();
    }

    refresh(): void {
        this._changeEvent.fire(undefined);
    }

    getDevices() : Device[] {
        return this.devices;
    }

    /* Factory methods to be implemented for each tree item type*/
    abstract createFolderTreeItem(device : Device) : vscode.TreeItem;

    abstract createBoardTreeItem(device : Device) : vscode.TreeItem;
    
    abstract createPortTreeItem(device : Device) : vscode.TreeItem;

}