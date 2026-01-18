import vscode from "vscode";
import {BoardTypes} from "../boardTypes";
import { DeviceModel } from "../deviceModel";

export abstract class DeviceTreeItem extends vscode.TreeItem {

    protected constructor(
        protected _device : DeviceModel,
        public readonly contextValue: string,
        protected readonly _updateTreeviewEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>,
        protected _isActive : boolean
    ) {
        const labelStr = `${_device.title ??'New Board'}`;
        super(labelStr, vscode.TreeItemCollapsibleState.Collapsed);
        this.description = this._isActive ? ' (Active)' : '';
    }

    public setActiveState(isActive: boolean) : void {
        this._isActive = isActive;
        this.updateAppearance();
    }

    getActiveProject(): vscode.WorkspaceFolder | undefined {
        return this._device.getFolder();
    }

    protected updateAppearance() {
        this.tooltip = `${this._device.board?.name ?? 'Unknown board'} at ${this._device.portPath ?? 'unknown port'}`;
        this.label = `${this._device.title ?? 'New Board'}`;
        this.description = this._isActive ? ' (Active)' : '';
    }

    getDevice(): DeviceModel {
        return this._device;
    }

    getBoard(): BoardTypes | undefined {
        return this._device.board;
    }

    getPort(): string | undefined {
        return this._device.portPath;
    }

    getDescription(): string[] | undefined {
        return this._device.description;
    };

    changeLabel(newLabel: string) {
        this.label = newLabel
    }

    changeActiveProject(newProject: vscode.WorkspaceFolder) {
        this._device.appPath = newProject.uri;
    }

    changeBoard(newBoard: BoardTypes) {
        this._device.board = newBoard;
    }

    changePort(newPort: string) {
        this._device.portPath = newPort;
    }

    changeDescription(newDescription: string[]) {
        this._device.description = newDescription;
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


}