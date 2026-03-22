import {SerialDevice} from "./serialDevice";
import {FlashInterface} from "../flash/flashInterface";
import {ESPLoader, FlashOptions, LoaderOptions, Transport} from "esptool-js";

export class EspDevice extends SerialDevice implements FlashInterface{

    async flash(binaries: {[offset:string]: Uint8Array}, args: string): Promise<void> {
        const argsArray = args.split(' ');
        const loaderOptions: LoaderOptions = {
            transport: new Transport(this._webPort as SerialPort),
            baudrate: Number.parseInt(argsArray[argsArray.indexOf('--baud')+1]),
            terminal: {
                clean: () => {
                    this.sendLog('clear\n');
                },
                write: (data: string) => {
                    this.sendLog(data);
                },
                writeLine: (data: string) => {
                    this.sendLog(data + '\n');
                }
            },
            debugLogging: true
        } as LoaderOptions;
        let file_array: { address: number; data: string }[] = [];
        for (const [key, data] of Object.entries(binaries)) {
            const address: number = parseInt(key);
            if(isNaN(address)) {
                throw new Error(`importFlasherArgs: Invalid address for file ${key}!`);
            }
            file_array.push({ address, data: [...data].map(v => String.fromCharCode(v)).join('') });
        }

        const flashOptions: FlashOptions = {
            fileArray: file_array,
            flashSize: "keep",
            flashMode: "keep",
            flashFreq: argsArray[argsArray.indexOf('--flash-freq')+1],
            compress: true,
            eraseAll: false
        };
        console.log('Starting Flash');
        const espLoader: ESPLoader = new ESPLoader(loaderOptions);
        await espLoader.main().then(value => console.log(value)).catch(e => console.error(e));
        await espLoader.writeFlash(flashOptions);
        await espLoader.after();
        await espLoader.transport.disconnect();
    }


}