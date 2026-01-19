import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";

export class VsCodeRiotFlashTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Flash", "flash");
    }

    protected getStringMakeCommand(): string {
        return 'make flash';
    }
}