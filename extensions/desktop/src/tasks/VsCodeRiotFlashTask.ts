import { DeviceModel } from "../boards/device";
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";

export class VsCodeRiotFlashTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Flash");
    }

    protected getStringMakeCommand(): string {
        return 'make flash';
    }
}