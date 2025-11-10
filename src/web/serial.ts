import vscode from "vscode";
import {TerminalProvider} from "./providers/terminalProvider";
import {ESPLoader, FlashOptions, LoaderOptions, Transport} from "esptool-js";

export class SerialDevice {
    public _open: boolean;
    private _reader?: ReadableStreamDefaultReader<string>;
    private _readableStreamClosed?: Promise<void>;
    private readonly _encoder = new TextEncoder();
    public readonly label:string;
    private _flashing: boolean;
    private _transport?: Transport;

    constructor(
        private readonly _port: SerialPort,
        public readonly contextValue: string,
    ) {
        this.label = 'Device: ' + _port.getInfo().usbVendorId + '|' + _port.getInfo().usbProductId;
        this._open = false;
        this._flashing = false;
    }

    async open(baudrate: number) {
        if (!this._open) {
            await this._port.open({baudRate: baudrate}).then(() => {
                console.log('Connected to ' + this.label);
                this._open = true;
                vscode.commands.executeCommand('setContext', 'riot-web.openDevice', [this.contextValue]);
            });
        }
    }

    async close() {
        if (this._reader) {
            this._reader.cancel();
            await this._readableStreamClosed?.catch(() => {console.log('Read canceled');});
        }
        if (this._open) {
            this._port.close().then(() => {
                console.log('Connection to ' + this.label + ' closed');
                this._open = false;
                vscode.commands.executeCommand('setContext', 'riot-web.openDevice', 'none');
            });
        }
    }

    forget() {
        this.close();
        this._port.forget().then(() => console.log('Forgot ' + this.label));
    }

    write(message: string) {
        if (this._open) {
            const writer = this._port.writable?.getWriter();
            if (writer === undefined) {
                return;
            }
            writer.write(this._encoder.encode(message)).then(() => console.log('Wrote Message: ' + message + ' to ' + this.label));
            writer.releaseLock();
        }
    }

    async read(terminal: TerminalProvider) {
        if (this._open) {
            const decoder = new TextDecoderStream();
            //@ts-ignore
            this._readableStreamClosed = this._port.readable?.pipeTo(decoder.writable);
            this._reader = decoder.readable.getReader();
            while (true) {
                const {value, done} = await this._reader.read();
                if (value) {
                    terminal.postMessage(value);
                }
                if (done || !value) {
                    this._reader.releaseLock();
                    break;
                }
            }
        }
    }

    getTransport() {
        if (this._transport) {
            return this._transport;
        }
        return new Transport(this._port);
    }

    freeTransport() {
        this._transport?.disconnect();
    }

    async flash(loaderOptions: LoaderOptions, flashOptions: FlashOptions) {
        if (!this._open) {
            loaderOptions.transport = new Transport(this._port);
            const espLoader: ESPLoader = new ESPLoader(loaderOptions);
            await espLoader.main().then(value => console.log(value)).catch(e => console.error(e));
            await espLoader.writeFlash(flashOptions).then(() => console.log('Programming Done')).catch(e => console.error(e));
            await espLoader.after();
            await espLoader.transport.disconnect();
        }
    }
}