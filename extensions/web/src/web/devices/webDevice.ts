import vscode from "vscode";
import {type RiotTerminal} from "../providers/terminalProvider";
import {Device} from "shared/types/device";

export type Port = SerialPort | USBDevice

export abstract class WebDevice extends Device {
    protected _open: boolean = false;
    protected _flashing: boolean = false;

    protected constructor(
        protected _port: Port,
        label: string,
        public readonly contextValue: string,
        protected readonly _updateTreeviewEventEmitter: vscode.EventEmitter<WebDevice | undefined>
    ) {
        super(label, contextValue, _updateTreeviewEventEmitter);
    }

    abstract comparePort(port: Port): boolean;

    abstract open(param?: object): Promise<void>;

    abstract close(): Promise<boolean>;

    abstract read(terminal: RiotTerminal): void;

    abstract write(message: string): void;
}