import { WorkspaceFolder } from "vscode";
import { Device } from "../../../../shared/types/device";
import { DeviceModel } from "../boards/device";
import * as vscode from 'vscode';
import { VsCodeRiotFlashTask } from "../tasks/VsCodeRiotFlashTask";


export class DeviceTreeItem extends Device {
    public constructor (
        private device : DeviceModel,
        _updateTreeviewEventEmitter: vscode.EventEmitter<Device | undefined>
    ){
        const labelStr = `${device.getDescription() ??'New Board'} `;
        super(labelStr, "riot-device", _updateTreeviewEventEmitter);
    }

    private updateToolTip() {
        this.tooltip = `${this.device.getBoardName() ?? 'Unknown board'} at ${this.device.getPortPath() ?? 'unknown port'}`;
        this.label = `${this.device.getDescription() ?? 'New Board'}`;
    }

    getDescription(): string[] {
        return [this.device.getDescription() ?? 'New Board'];
    }

    getDesktopDescription(): string | undefined {
        return this.device.getDescription();
    }
    
    forget(): void {
        throw new Error("Method not implemented.");
    }

    flash(param?: object): void {
        const device = this.getDevice();
        const appPath = device.getAppPath();
        if(!appPath || !device) {
            vscode.window.showErrorMessage("Application folder or device not properly selected.");
            return;
        }
        const flashTask = new VsCodeRiotFlashTask(appPath.fsPath, device).getVscodeTask();
        if(!flashTask) {
            vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
            return;
        }
        vscode.tasks.executeTask(flashTask);
    }
    
    getDevice() : DeviceModel {
        return this.device;
    }

    setDescription(description : string) : void {
        this.device.setDescription(description);
        this.updateToolTip();
    }
        

}