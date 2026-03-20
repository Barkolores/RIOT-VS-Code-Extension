import vscode from "vscode";
import {WebDevice} from "../webDevice";

export class SerialDevice extends WebDevice {

    private _reader?: ReadableStreamDefaultReader<string>;

    private readonly _encoder = new TextEncoder();
    private _readableStreamClosed?: Promise<void>;
    constructor(
        label: string,
        contextValue: string,
        board: string | undefined,
        serialPort: SerialPort,
        dmPort: MessagePort,
    ) {
        super(label, contextValue, board, serialPort, dmPort);
        const serialPortInfo = serialPort.getInfo();
        this._description = [
            'Web API: Serial',
            'USBVendorID: ' + (serialPortInfo.usbVendorId ? serialPortInfo.usbVendorId : 'Not specified'),
            'USBProductID: ' + (serialPortInfo.usbProductId ? serialPortInfo.usbProductId : 'Not specified'),
            'BluetoothServiceClassID: ' + (serialPortInfo.bluetoothServiceClassId ? serialPortInfo.bluetoothServiceClassId : 'Not specified'),
        ];
    }

    comparePort(webPort: SerialPort): boolean {
        return webPort === this._webPort;
    }

    protected async close() {
        if (this._flashing) {
            vscode.window.showErrorMessage(this.label + ' is currently flashing. Please wait until flashing is completed.');
            return;
        }
        if (this._reader) {
            await this._reader.cancel();
            await this._readableStreamClosed?.catch(() => {});
            this._reader = undefined;
            this._readableStreamClosed = undefined;
        }
        this._webPort.close().then(() => {
            console.log('Connection to ' + this.label + ' closed');
            return true;
        });
    }

    protected async read(): Promise<void> {
        this.startLogBundling();
        const decoder = new TextDecoderStream();
        //@ts-ignore
        this._readableStreamClosed = this._webPort.readable?.pipeTo(decoder.writable);
        this._reader = decoder.readable.getReader();
        if (this._reader === undefined) {
            throw Error('Reader not accessible');
        }
        while (true) {
            const {value, done} = await this._reader.read();
            if (value) {
                this._logMessages += value;
            }
            if (done || !value) {
                this._reader.releaseLock();
                break;
            }
        }
        this.stopLogBundling();
    }

    protected write(message: string): void {
        const writer = (this._webPort as SerialPort).writable?.getWriter();
        if (writer === undefined) {
            return;
        }
        writer.write(this._encoder.encode(message)).then(() => console.log('Wrote Message: ' + message + ' to ' + this.label));
        writer.releaseLock();
    }

    protected async term(param: SerialOptions) {
        await this._webPort.open(param).then(() => {
                this.read();
            }
        );
    }
}