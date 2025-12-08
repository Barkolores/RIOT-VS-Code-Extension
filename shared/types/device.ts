import vscode from "vscode";

export abstract class Device extends vscode.TreeItem {
    activeProject: vscode.WorkspaceFolder | undefined = undefined;

    protected constructor(
        label: string,
        public readonly contextValue: string,
        protected readonly _updateTreeviewEventEmitter: vscode.EventEmitter<Device | undefined>
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
    }

    abstract getDescription(): string[];

    abstract forget(): void;

    abstract flash(param?: object): void;

    updateTreeview(): void {
        this._updateTreeviewEventEmitter.fire(undefined);
    };
}