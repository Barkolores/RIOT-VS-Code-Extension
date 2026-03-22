import vscode from "vscode";

export abstract class DeviceTreeItem extends vscode.TreeItem {

    protected static readonly defaultBoard: string = 'native';
    protected _description?: string[];

    protected constructor(
        label: string,
        public readonly contextValue: string,
        protected readonly _board: string | undefined,
        protected _port?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
    }

    getBoard(): string | undefined {
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
    };
    
    changePort(newPort: string) {
        this._port = newPort;
    }    


}