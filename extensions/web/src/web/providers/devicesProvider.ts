import * as vscode from "vscode";
import {WebDevice} from "../devices/webDevice";

export class DevicesProvider implements vscode.TreeDataProvider<WebDevice> {
    private _devices?: WebDevice[];

    getTreeItem(element: vscode.TreeItem | Thenable<vscode.TreeItem>) {
        return element;
    }

    getChildren(element?: WebDevice): vscode.ProviderResult<any[]> {
        if (element) {
            return element.getDescription().map<DeviceDescription>((label) => new DeviceDescription(label));
        } else {
            return Promise.resolve(this._devices);
        }
    }

    readonly onDidChangeTreeDataEventEmitter: vscode.EventEmitter<WebDevice | undefined> = new vscode.EventEmitter<WebDevice | undefined>();

    readonly onDidChangeTreeData: vscode.Event<WebDevice | undefined> = this.onDidChangeTreeDataEventEmitter.event;

    refresh(): void {
        this.onDidChangeTreeDataEventEmitter.fire(undefined);
    }

    setDevices(devices: WebDevice[]): void {
        this._devices = devices;
    }
}

class DeviceDescription extends vscode.TreeItem {

    constructor(
        public readonly label: string,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'description';
    }

}