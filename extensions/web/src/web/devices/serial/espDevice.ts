import {SerialDevice} from "./serialDevice";
import {FlashInterface} from "../flash/flashInterface";
import {ESPLoader, FlashOptions, LoaderOptions, Transport} from "esptool-js";
import {deviceState} from "../webDevice";

export class EspDevice extends SerialDevice implements FlashInterface{

    async flash(options: {
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