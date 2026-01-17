import { WorkspaceFolder } from "vscode";
import { DeviceTreeItem } from "../../../../shared/ui/treeItems/deviceTreeItem";
import { DeviceModel } from "../boards/device";
import * as vscode from 'vscode';
import { VsCodeRiotFlashTask } from "../tasks/VsCodeRiotFlashTask";


export class DesktopDeviceTreeItem extends DeviceTreeItem {

    public constructor (
        private device : DeviceModel,
        _updateTreeviewEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>,
        private isActive: boolean = false
    ){
        const labelStr = `${device.getTitle() ??'New Board'} ${isActive ? '(active)' : ''}`;
        super(labelStr, "riot-device", _updateTreeviewEventEmitter);
    }

    public setActiveState(isActive: boolean) : void {
        this.isActive = isActive;
        this.updateAppearance();
    }

    private updateAppearance() {
        this.tooltip = `${this.device.getBoardName() ?? 'Unknown board'} at ${this.device.getPortPath() ?? 'unknown port'}`;
        this.label = `${this.device.getTitle() ?? 'New Board'}`;
        this.description = this.isActive ? ' (Active)' : '';
    }

    getDescription(): string[] {
        return [];
    }

    getTitle(): string | undefined {
        return this.device.getTitle();
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
        this.updateAppearance();
    }
        

}