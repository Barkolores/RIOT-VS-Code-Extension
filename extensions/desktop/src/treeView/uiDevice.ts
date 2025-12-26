import { WorkspaceFolder } from "vscode";
import { Device } from "../../../../shared/types/device";
import { DeviceModel } from "../boards/device";
import * as vscode from 'vscode';


export class DeviceTreeItem extends Device {
    public constructor (
        private device : DeviceModel,
        _updateTreeviewEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>
    ){
        const labelStr = `${device.getBoardName() ?? 'New Board'} `;
        super(labelStr, "riot-device", _updateTreeviewEventEmitter);
    }

    private updateToolTip() {
        this.tooltip = `${this.device.getBoardName() ?? 'Unknown board'} at ${this.device.getPortPath() ?? 'unknown port'}`;
    }

    getDescription(): string[] {
        throw new Error("Method not implemented.");
    }
    
    forget(): void {
        throw new Error("Method not implemented.");
    }

    flash(param?: object): void {
        throw new Error("Method not implemented.");
    }
    
    getDevice() : DeviceModel {
        return this.device;
    }

        

}