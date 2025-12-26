import * as vscode from 'vscode';
import { DeviceTreeItem } from './uiDevice';
import { DeviceModel } from '../boards/device';
import { SelectedBoardTreeItem } from './uiSelBoard';
import { SelectedFolderTreeItem } from './uiSelFolder';
import { SelectedPortTreeItem } from './uiSelPort';

export class DeviceTreeItemProvider implements vscode.TreeDataProvider<vscode.TreeItem>{
    private _changeEvent = new vscode.EventEmitter<DeviceTreeItem | undefined>();
    readonly onDidChangeTreeData = this._changeEvent.event;
    private deviceItems : DeviceTreeItem[];

    constructor(
        devices? : DeviceModel[]
    ) {
        this.deviceItems = devices ? devices.map(
            d => new DeviceTreeItem(d, this._changeEvent)
        ) : [];
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        /* Not really satisfied with this if-check since it requires a type-cast
        and an additional getter for DeviceTreeItem 
        Considering to put an abstract TreeItem class above all but this should be
        sufficient for now */
        if(!element) {
            return this.deviceItems; 
        }else if(element instanceof DeviceTreeItem) {
            const deviceItem = element as DeviceTreeItem;
            return [
                new SelectedBoardTreeItem(deviceItem.getDevice()),
                new SelectedFolderTreeItem(deviceItem.getDevice()),
                new SelectedPortTreeItem(deviceItem.getDevice())
            ];  
        }
    }

    addDevice (device : DeviceModel) : void {
        this.deviceItems.push(new DeviceTreeItem(device, this._changeEvent));
        this.refresh();
    }

    refresh() : void {
        this._changeEvent.fire(undefined);
    }
     
}