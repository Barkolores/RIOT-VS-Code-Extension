import { Device } from "../device";
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";

export class VsCodeRiotFlashTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : Device
    ) {
        super(applicationPath, device, "RIOT Flash");
    }

    protected getStringMakeCommand(): string {
        return 'make flash';
    }
}