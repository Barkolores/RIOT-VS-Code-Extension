import vscode from "vscode";
import {type RiotTerminal} from "../providers/terminalProvider";

export type Port = SerialPort | USBDevice

export abstract class Device extends vscode.TreeItem {
    protected _open: boolean = false;
    protected _flashing: boolean = false;

    protected constructor(
        protected _port: Port,
        label: string,
        public readonly contextValue: string,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
    }

    abstract comparePort(port: Port): boolean;

    abstract open(param?: object): Promise<void>;

    abstract close(): Promise<void>;

    abstract forget(): void;

    abstract read(terminal: RiotTerminal): void;

    abstract write(message: string): void;

    abstract flash(param?: object): void;

}