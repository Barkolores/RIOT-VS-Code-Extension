import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';

//Keeping dead code as inspiration
export class DeviceProvider {

    private _onDidChangeTreeData: vscode.EventEmitter<DeviceModel | undefined | void> = new vscode.EventEmitter<DeviceModel | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<DeviceModel | undefined | void> = this._onDidChangeTreeData.event;

    private devices: DeviceModel[] = [];

    constructor(devices? : DeviceModel[]) {
        this.devices = devices ?? [];  
    }

    refresh(newDevices?: DeviceModel[]): void {
        if(newDevices) {
            this.devices = newDevices;
        }
        this._onDidChangeTreeData.fire(undefined);
    }
    
    // getTreeItem(element: DeviceModel): vscode.TreeItem {
    //     return element;
    // }

    // getChildren(element?: DeviceModel): vscode.ProviderResult<DeviceModel[]> {
    //     if (!element) {
    //         return this.devices;
    //     } 
    //     return [];
    // }

    public removeDevice(device: DeviceModel): void {
        this.devices.forEach((d : DeviceModel, i : number) => {
            if(d === device) {
                this.devices.splice(i, 1);
            }
        }); 
        this.refresh();
    }

    public addDevice(device: DeviceModel): void {
        this.devices.push(device);
        this.refresh();
    }

    public getDevices(): DeviceModel[] {
        return this.devices;
    }
}