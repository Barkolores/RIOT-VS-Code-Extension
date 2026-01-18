import { WorkspaceFolder } from "vscode";
import { DeviceTreeItem } from "../../../../shared/ui/treeItems/deviceTreeItem";
import { DeviceModel } from "../../../../shared/ui/deviceModel";
import * as vscode from 'vscode';
import { VsCodeRiotFlashTask } from "../tasks/VsCodeRiotFlashTask";


export class DesktopDeviceTreeItem extends DeviceTreeItem {

    public constructor (
        device : DeviceModel,
        _updateTreeviewEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>,
        isActive: boolean = false
    ){
        const labelStr = `${device.title ??'New Board'} ${isActive ? '(active)' : ''}`;
        super(device, "riot-device", _updateTreeviewEventEmitter, isActive);
    }
    
    flash(param?: object): void {
        const device = this.getDevice();
        const appPath = device.appPath;
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
    
        

}