import {SerialDevice} from "./serialDevice";
import {FlashInterface} from "../flash/flashInterface";
import {ESPLoader, FlashOptions, LoaderOptions, Transport} from "esptool-js";

export class EspDevice extends SerialDevice implements FlashInterface{

    async flash(binaries: {[offset:string]: string}, args: string): Promise<void> {
        //TODO parse from args
        const loaderOptions: LoaderOptions = {
            transport: new Transport(this._webPort as SerialPort),
            baudrate: 460800,
            terminal: {
                clean() {
                    super._logMessages += 'clear\n';
                },
                write(data: string) {
                    super._logMessages += data;
                },
                writeLine(data: string) {
                    super._logMessages += data + '\n';
                }
            },
            debugLogging: true
        } as LoaderOptions;
        let file_array: { address: number; data: string }[] = [];
        for (const [key, data] of Object.entries(binaries)) {
            const address: number = parseInt(key, 16);
            if(isNaN(address)) {
                throw new Error(`importFlasherArgs: Invalid address for file ${key}!`);
            }
            file_array.push({ address, data });
        }

        // determine flash size
        // let flashSize = json.flash_size;
        // if(flashSize === "detect") {
        //     flashSize = "keep";
        // }

        const flashOptions: FlashOptions = {
            fileArray: file_array,
            flashSize: "keep",
            flashMode: "keep",
            flashFreq: "40m",
            compress: true,
            eraseAll: false
        };
        const espLoader: ESPLoader = new ESPLoader(loaderOptions);
        await espLoader.main().then(value => console.log(value)).catch(e => console.error(e));
        await espLoader.writeFlash(flashOptions).then(() => console.log('Programming Done')).catch(e => console.error(e));
        await espLoader.after();
        await espLoader.transport.disconnect();
    }
}