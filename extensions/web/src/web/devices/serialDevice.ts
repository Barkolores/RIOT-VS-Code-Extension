import vscode from "vscode";
import {WebDevice} from "./webDevice";
import {ESPLoader, type FlashOptions, type LoaderOptions, Transport} from "esptool-js";
import {type RiotTerminal} from "../providers/terminalProvider";

export class SerialDevice extends WebDevice {

    private _reader?: ReadableStreamDefaultReader<string>;
    private _readableStreamClosed?: Promise<void>;
    private readonly _encoder = new TextEncoder();
    private _transport?: Transport;

    constructor(
        port: SerialPort,
        contextValue: string,
        id: number,
        eventEmitter: vscode.EventEmitter<WebDevice | undefined>,
    ) {
        super(port, 'Device ' + id, contextValue, eventEmitter);
    }
    getDescription(): string[] {
        const port = this._port as SerialPort;
        return [
            'Status: ' + (this._flashing ? 'Flashing' : (this._open ? 'Connection open' : 'Connection closed')),
            'CurrentWorkingDirectory: ' + (this.activeProject ? this.activeProject.name : 'Not specified'),
            'USBVendorID: ' + port.getInfo().usbVendorId,
            'USBProductID: ' + port.getInfo().usbProductId,
            'BluetoothServiceClassID: ' + (port.getInfo().bluetoothServiceClassId ? port.getInfo().bluetoothServiceClassId : 'Not specified'),
        ];
    }


    comparePort(port: SerialPort): boolean {
        return port === this._port;
    }
    async open(param: SerialOptions): Promise<void> {
        if (!this._open) {
            await this._port.open(param).then(() => {
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
            return this._port.close().then(() => {
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
        this._port.forget().then(() => console.log('Forgot ' + this.label));
    }
    async read(terminal: RiotTerminal): Promise<void> {
        if (this._open) {
            const decoder = new TextDecoderStream();
            //@ts-ignore
            this._readableStreamClosed = this._port.readable?.pipeTo(decoder.writable);
            this._reader = decoder.readable.getReader();
            while (true) {
                const {value, done} = await this._reader.read();
                if (value) {
                    terminal.postMessage(this.contextValue, value);
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
            const writer = (this._port as SerialPort).writable?.getWriter();
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
            options.loaderOptions.transport = new Transport(this._port as SerialPort);
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
        return new Transport(this._port as SerialPort);
    }
}