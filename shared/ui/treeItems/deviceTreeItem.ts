import vscode from "vscode";
import {BoardTypes} from "../boardTypes";

export abstract class DeviceTreeItem extends vscode.TreeItem {

    protected _activeProject?: vscode.WorkspaceFolder;
    protected _board?: BoardTypes;
    protected _description?: string[];

    protected constructor(
        label: string,
        public readonly contextValue: string,
        protected readonly _updateTreeviewEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>,
        protected _port?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
    }

    getActiveProject(): vscode.WorkspaceFolder | undefined {
        return this._activeProject;
    }

    getBoard(): BoardTypes | undefined {
        return this._board;
    }

    getPort(): string | undefined {
        return this._port;
    }

    getDescription(): string[] | undefined {
        return this._description;
    };

    changeLabel(newLabel: string) {
        this.label = newLabel
    }

    changeActiveProject(newProject: vscode.WorkspaceFolder) {
        this._activeProject = newProject;
    }

    changeBoard(newBoard: BoardTypes) {
        this._board = newBoard;
    }

    changePort(newPort: string) {
        this._port = newPort;
    }

    changeDescription(newDescription: string[]) {
        this._description = newDescription;
    }

    updateTreeview(): void {
        this._updateTreeviewEventEmitter.fire(undefined);
    };
}