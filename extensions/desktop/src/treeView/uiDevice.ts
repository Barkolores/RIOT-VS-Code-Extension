import { WorkspaceFolder } from "vscode";
import { DeviceTreeItem } from "../../../../shared/ui/treeItems/deviceTreeItem";
import { DeviceModel } from "./deviceModel";
import * as vscode from 'vscode';
import { VsCodeRiotFlashTask } from "../tasks/VsCodeRiotFlashTask";


export class DesktopDeviceTreeItem extends DeviceTreeItem {

    public constructor (
        protected _device : DeviceModel,
        protected _updateTreeviewEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>,
        protected _isActive: boolean = false
    ){
        const labelStr = `${_device.title ??'New Board'} ${_isActive ? '(active)' : ''}`;
        super(labelStr, "riot-device", _device.board, _device.portPath);
    }
    
    public setActiveState(isActive: boolean) : void {
        this._isActive = isActive;
        this.updateAppearance();
    }


    flash(): void {
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
    
    updateTreeview(): void {
        this._updateTreeviewEventEmitter.fire(undefined);
    };

    setTitle(title : string) : void {
        this._device.title = title;
        this.updateAppearance();
    }

    getTitle(): string | undefined {
        return this._device.title;
    }

    changeBoard(newBoard: string) {
        this._device.board = newBoard;
    }

    changeDescription(newDescription: string[]) {
        this._device.description = newDescription;
    }

    protected updateAppearance() {
        this.tooltip = `${this._device.board ?? 'Unknown board'} at ${this._device.portPath ?? 'unknown port'}`;
        this.label = `${this._device.title ?? 'New Board'}`;
        this.description = this._isActive ? ' (Active)' : '';
    }

    public getDevice(): DeviceModel {
        return this._device;
    }

}