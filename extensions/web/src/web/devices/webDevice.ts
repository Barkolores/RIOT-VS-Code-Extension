import vscode from "vscode";
import {DeviceTreeItem} from "shared/ui/treeItems/deviceTreeItem";
import {webPort} from "./webPort";
import {WebSocketManager} from "../websocket/webSocketManager";

export abstract class WebDevice extends DeviceTreeItem {
    protected _open: boolean = false;
    protected _flashing: boolean = false;

    protected constructor(
        protected _webPort: webPort,
        label: string,
        public readonly contextValue: string,
        protected readonly _updateTreeviewEventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>
    ) {
        super(label, contextValue, _updateTreeviewEventEmitter);
    }

    abstract comparePort(port: webPort): boolean;

    abstract open(param?: object): Promise<void>;

    abstract close(): Promise<boolean>;

    abstract read(webSocketManager: WebSocketManager): void;

    abstract write(message: string): void;

    abstract forget(): void;

    abstract flash(param?: object): void;
}