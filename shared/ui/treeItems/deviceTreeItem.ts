import vscode from "vscode";

export abstract class DeviceTreeItem extends vscode.TreeItem {

    protected _activeProject?: vscode.WorkspaceFolder;
    protected static readonly _defaultBoard: string = 'native';
    protected _description?: string[];

    protected constructor(
        label: string,
        public readonly contextValue: string,
        protected readonly _board: string,
        protected _port?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
    }

    getActiveProject(): vscode.WorkspaceFolder | undefined {
        return this._activeProject;
    }

    getBoard(): string {
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

    changePort(newPort: string) {
        this._port = newPort;
    }
}