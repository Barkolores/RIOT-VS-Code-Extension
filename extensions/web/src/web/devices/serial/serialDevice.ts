import vscode from "vscode";
import {deviceState, WebDevice} from "../webDevice";
import {ESPLoader, type FlashOptions, type LoaderOptions, Transport} from "esptool-js";
import {DeviceTreeItem} from "shared/ui/treeItems/deviceTreeItem";
import {logTypes, messageTypes} from "../../websocket/api/additionalTypes";
import {outboundDeviceMessage} from "../../websocket/api/outbound/outboundDeviceMessage";

export class SerialDevice extends WebDevice {

    private _reader?: ReadableStreamDefaultReader<string>;
    private _readableStreamClosed?: Promise<void>;
    private readonly _encoder = new TextEncoder();

    constructor(
        protected _webPort: SerialPort,
        contextValue: string,
        label: string,
        eventEmitter: vscode.EventEmitter<DeviceTreeItem | undefined>,
        dmPort: MessagePort
    ) {
        super(_webPort, label, contextValue, eventEmitter, dmPort);
        this._description = [
            'USBVendorID: ' + (_webPort.getInfo().usbVendorId ? _webPort.getInfo().usbVendorId : 'Not specified'),
            'USBProductID: ' + (_webPort.getInfo().usbProductId ? _webPort.getInfo().usbProductId : 'Not specified'),
            'BluetoothServiceClassID: ' + (_webPort.getInfo().bluetoothServiceClassId ? _webPort.getInfo().bluetoothServiceClassId : 'Not specified'),
        ];
    }

    comparePort(webPort: SerialPort): boolean {
        return webPort === this._webPort;
    }

    forget(): void {
        this.close();
        this._webPort.forget().then(() => console.log('Forgot ' + this.label));
    }

    protected async close() {
        if (this._currentState === deviceState.FLASH) {
            vscode.window.showErrorMessage(this.label + ' is currently flashing. Please wait until flashing is completed.');
            return;
        }
        if (this._reader) {
            this._reader.cancel();
            await this._readableStreamClosed?.catch(() => {console.log('Read canceled');});
            this._reader = undefined;
            this._readableStreamClosed = undefined;
        }
        this._webPort.close().then(() => {
            console.log('Connection to ' + this.label + ' closed');
            this._currentState = deviceState.IDLE;
            return true;
        }).catch((e) => {
            console.log(e);
        });
    }

    protected async read(): Promise<void> {
        if (this._currentState === deviceState.TERM || this._currentState === deviceState.FLASH) {
            this.startLogBundling();
            const decoder = new TextDecoderStream();
            //@ts-ignore
            this._readableStreamClosed = this._webPort.readable?.pipeTo(decoder.writable);
            this._reader = decoder.readable.getReader();
            while (true) {
                const {value, done} = await this._reader.read();
                if (value) {
                    this._logMessages.push(value);
                }
                if (done || !value) {
                    this._reader.releaseLock();
                    break;
                }
            }
            this.stopLogBundling();
        }
    }

    protected write(message: string): void {
        if (this._currentState === deviceState.TERM) {
            const writer = (this._webPort as SerialPort).writable?.getWriter();
            if (writer === undefined) {
                return;
            }
            writer.write(this._encoder.encode(message)).then(() => console.log('Wrote Message: ' + message + ' to ' + this.label));
            writer.releaseLock();
        }
    }

    protected async term(param: SerialOptions) {
        await this._webPort.open(param).then(() => {
                this._currentState = deviceState.TERM;
                this.read();
            }
        );
    }

    protected async flash(options: {
        loaderOptions: LoaderOptions,
        flashOptions: FlashOptions,
    }): Promise<void> {
        this._currentState = deviceState.FLASH;
        options.loaderOptions.transport = new Transport(this._webPort as SerialPort);
        const espLoader: ESPLoader = new ESPLoader(options.loaderOptions);
        await espLoader.main().then(value => console.log(value)).catch(e => console.error(e));
        await espLoader.writeFlash(options.flashOptions).then(() => console.log('Programming Done')).catch(e => console.error(e));
        await espLoader.after();
        await espLoader.transport.disconnect();
        this._currentState = deviceState.IDLE;
    }
}