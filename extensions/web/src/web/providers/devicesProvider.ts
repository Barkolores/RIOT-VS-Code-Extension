import * as vscode from "vscode";
import {WebDevice} from "../devices/webDevice";
import {ProviderResult} from "vscode";

export class DevicesProvider implements vscode.TreeDataProvider<WebDevice> {
    private _devices?: WebDevice[];

    getTreeItem(element: vscode.TreeItem | Thenable<vscode.TreeItem>) {
        return element;
    }

    getChildren(element?: WebDevice | DeviceDescriptionHeader): vscode.ProviderResult<any[]> {
        if (element) {
            if (element.contextValue === 'description') {
                return (element as DeviceDescriptionHeader).parent.getDescription().map<DeviceDescription>((label) => new DeviceDescription(label));
            } else {
                return Promise.resolve([
                    new Cwd('Current Working Directory: Undefined'),
                    new Button('Terminal', element as WebDevice),
                    new Button('Flash', element as WebDevice),
                    new Button('Flash with Debugging', element as WebDevice),
                    new DeviceDescriptionHeader('Stats', element as WebDevice)
                ]);
            }
        } else {
            return Promise.resolve(this._devices);
        }
    }

    getParent(element: WebDevice): ProviderResult<WebDevice> {
        return;
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

class DeviceDescriptionHeader extends vscode.TreeItem {

    constructor(
        public readonly label: string,
        public readonly parent: WebDevice,
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'description';
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

export class Button extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly parent: WebDevice
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'button';
    }
}

class Cwd extends vscode.TreeItem {
    constructor(
        public readonly label: string,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'workingDirectory';
    }
}