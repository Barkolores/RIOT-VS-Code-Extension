import * as vscode from 'vscode';
import { Device } from './device';

export class DeviceProvider implements vscode.TreeDataProvider<Device> {

    private _onDidChangeTreeData: vscode.EventEmitter<Device | undefined | void> = new vscode.EventEmitter<Device | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<Device | undefined | void> = this._onDidChangeTreeData.event;

    private devices: Device[] = [];

    constructor(devices? : Device[]) {
        this.devices = devices ?? [];  
    }

    refresh(newDevices?: Device[]): void {
        if(newDevices) {
            this.devices = newDevices;
        }
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element: Device): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Device): vscode.ProviderResult<Device[]> {
        if (!element) {
            return this.devices;
        } 
        return [];
    }

    public removeDevice(device: Device): void {
        this.devices.forEach((d : Device, i : number) => {
            if(d === device) {
                this.devices.splice(i, 1);
            }
        }); 
        this.refresh();
    }

    public addDevice(device: Device): void {
        this.devices.push(device);
        this.refresh();
    }

    public getDevices(): Device[] {
        return this.devices;
    }
}