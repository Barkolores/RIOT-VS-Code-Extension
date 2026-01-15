import * as vscode from 'vscode';
import { DeviceTreeItem } from './treeItems/deviceTreeItem';
import {FolderTreeItem} from "./treeItems/folderTreeItem";
import {PortTreeItem} from "./treeItems/portTreeItem";
import {BoardTreeItem} from "./treeItems/boardTreeItem";
import {DescriptionTreeItem} from "./treeItems/descriptionTreeItem";
import {DescriptionHeaderTreeItem} from "./treeItems/descriptionHeaderTreeItem";

export class DeviceProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    protected _devices : DeviceTreeItem[];

    readonly onDidChangeTreeDataEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined> = new vscode.EventEmitter<DeviceTreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEventEmitter.event;

    constructor(
        devices? : DeviceTreeItem[]
    ) {
        this._devices = devices ?? [];
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
                    new FolderTreeItem(device),
                    new BoardTreeItem(device),
                )
                if (device.getPort() !== undefined) {
                    items.push(
                        new PortTreeItem(device)
                    )
                }
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

    refresh(): void {
        this.onDidChangeTreeDataEventEmitter.fire(undefined);
    }

    setDevices(devices: DeviceTreeItem[]): void {
        this._devices = devices;
    }
}