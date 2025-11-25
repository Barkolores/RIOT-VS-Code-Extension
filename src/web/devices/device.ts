import vscode from "vscode";
import {type RiotTerminal} from "../providers/terminalProvider";

export type Port = SerialPort | USBDevice

export abstract class Device extends vscode.TreeItem {
    protected _open: boolean = false;
    protected _flashing: boolean = false;
    activeProject: vscode.WorkspaceFolder | undefined = undefined;

    protected constructor(
        protected _port: Port,
        label: string,
        public readonly contextValue: string,
        protected readonly _updateTreeviewEventEmitter: vscode.EventEmitter<Device | undefined>
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
    }

    abstract getDescription(): string[];

    abstract comparePort(port: Port): boolean;

    abstract open(param?: object): Promise<void>;

    abstract close(): Promise<boolean>;

    abstract forget(): void;

    abstract read(terminal: RiotTerminal): void;

    abstract write(message: string): void;

    abstract flash(param?: object): void;

    updateTreeview(): void {
        this._updateTreeviewEventEmitter.fire(undefined);
    };
}