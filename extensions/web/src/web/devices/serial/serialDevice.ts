import vscode from "vscode";
import {WebDevice} from "../webDevice";
import {ESPLoader, type FlashOptions, type LoaderOptions, Transport} from "esptool-js";
import {WebSocketManager} from "../../websocket/webSocketManager";
import {DeviceTreeItem} from "shared/ui/treeItems/deviceTreeItem";

export class SerialDevice extends WebDevice {

    private _reader?: ReadableStreamDefaultReader<string>;
    private _readableStreamClosed?: Promise<void>;
    private readonly _encoder = new TextEncoder();
    private _transport?: Transport;

    constructor(
        webPort: SerialPort,
        contextValue: string,
        label: string,
        eventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>,
    ) {
        super(webPort, label, contextValue, eventEmitter);
        this._description = [
            'Status: ' + (this._flashing ? 'Flashing' : (this._open ? 'Connection open' : 'Connection closed')),
            'CurrentWorkingDirectory: ' + (this._activeProject ? this._activeProject.name : 'Not specified'),
            'USBVendorID: ' + webPort.getInfo().usbVendorId,
            'USBProductID: ' + webPort.getInfo().usbProductId,
            'BluetoothServiceClassID: ' + (webPort.getInfo().bluetoothServiceClassId ? webPort.getInfo().bluetoothServiceClassId : 'Not specified'),
        ];
    }

    comparePort(webPort: SerialPort): boolean {
        return webPort === this._webPort;
    }
    async open(param: SerialOptions): Promise<void> {
        if (!this._open) {
            await this._webPort.open(param).then(() => {
                console.log('Connected to ' + this.label);
                this._open = true;
                this.updateTreeview();
            });
        }
    }
    async close(): Promise<boolean> {
        if (this._flashing) {
            vscode.window.showErrorMessage(this.label + ' is currently flashing. Please wait until flashing is completed.');
            return false;
        }
        if (this._reader) {
            this._reader.cancel();
            await this._readableStreamClosed?.catch(() => {console.log('Read canceled');});
            this._reader = undefined;
            this._readableStreamClosed = undefined;
        }
        if (this._open) {
            return this._webPort.close().then(() => {
                console.log('Connection to ' + this.label + ' closed');
                this._open = false;
                this.updateTreeview();
                return true;
            }).catch((e) => {
                console.error(e);
                console.error('Connection to ' + this.label + ' could not be closed');
                return false;
            });
        }
        return true;
    }
    forget(): void {
        this.close();
        this._webPort.forget().then(() => console.log('Forgot ' + this.label));
    }
    async read(webSocketManager: WebSocketManager): Promise<void> {
        if (this._open) {
            const decoder = new TextDecoderStream();
            //@ts-ignore
            this._readableStreamClosed = this._webPort.readable?.pipeTo(decoder.writable);
            this._reader = decoder.readable.getReader();
            while (true) {
                const {value, done} = await this._reader.read();
                if (value) {
                    webSocketManager.postMessage(value);
                }
                if (done || !value) {
                    this._reader.releaseLock();
                    break;
                }
            }
        }
    }
    write(message: string): void {
        if (this._open) {
            const writer = (this._webPort as SerialPort).writable?.getWriter();
            if (writer === undefined) {
                return;
            }
            writer.write(this._encoder.encode(message)).then(() => console.log('Wrote Message: ' + message + ' to ' + this.label));
            writer.releaseLock();
        }
    }
    async flash(options: {
        loaderOptions: LoaderOptions,
        flashOptions: FlashOptions,
    }): Promise<void> {
        if (!this._open) {
            this._flashing = true;
            this.updateTreeview();
            options.loaderOptions.transport = new Transport(this._webPort as SerialPort);
            const espLoader: ESPLoader = new ESPLoader(options.loaderOptions);
            await espLoader.main().then(value => console.log(value)).catch(e => console.error(e));
            await espLoader.writeFlash(options.flashOptions).then(() => console.log('Programming Done')).catch(e => console.error(e));
            await espLoader.after();
            await espLoader.transport.disconnect();
            this._flashing = false;
            this.updateTreeview();
        }
    }
    getTransport() {
        if (this._transport) {
            return this._transport;
        }
        return new Transport(this._webPort as SerialPort);
    }
}