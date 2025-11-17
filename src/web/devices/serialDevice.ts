import vscode from "vscode";
import {Device} from "./device";
import {ESPLoader, type FlashOptions, type LoaderOptions, Transport} from "esptool-js";
import {type RiotTerminal} from "../providers/terminalProvider";

export class SerialDevice extends Device {

    private _reader?: ReadableStreamDefaultReader<string>;
    private _readableStreamClosed?: Promise<void>;
    private readonly _encoder = new TextEncoder();
    private _transport?: Transport;

    constructor(
        port: SerialPort,
        contextValue: string,
    ) {
        super(port, 'Device: ' + port.getInfo().usbVendorId + '|' + port.getInfo().usbProductId, contextValue);
    }
    comparePort(port: SerialPort): boolean {
        return port === this._port;
    }
    async open(param: SerialOptions): Promise<void> {
        if (!this._open) {
            await this._port.open(param).then(() => {
                console.log('Connected to ' + this.label);
                this._open = true;
                vscode.commands.executeCommand('riot-web-extension.context.connect', this.contextValue);
            });
        }
    }
    async close(): Promise<void> {
        if (this._flashing) {
            vscode.window.showErrorMessage(this.label + ' is currently flashing. Please wait until flashing is completed.');
            return;
        }
        if (this._reader) {
            this._reader.cancel();
            await this._readableStreamClosed?.catch(() => {console.log('Read canceled');});
        }
        if (this._open) {
            this._port.close().then(() => {
                console.log('Connection to ' + this.label + ' closed');
                this._open = false;
                vscode.commands.executeCommand('riot-web-extension.context.disconnect', this.contextValue);
            });
        }
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
            vscode.commands.executeCommand('riot-web-extension.context.connect', this.contextValue);
            options.loaderOptions.transport = new Transport(this._port as SerialPort);
            const espLoader: ESPLoader = new ESPLoader(options.loaderOptions);
            await espLoader.main().then(value => console.log(value)).catch(e => console.error(e));
            await espLoader.writeFlash(options.flashOptions).then(() => console.log('Programming Done')).catch(e => console.error(e));
            await espLoader.after();
            await espLoader.transport.disconnect();
            vscode.commands.executeCommand('riot-web-extension.context.disconnect', this.contextValue);
            this._flashing = false;
        }
    }
    getTransport() {
        if (this._transport) {
            return this._transport;
        }
        return new Transport(this._port as SerialPort);
    }
}