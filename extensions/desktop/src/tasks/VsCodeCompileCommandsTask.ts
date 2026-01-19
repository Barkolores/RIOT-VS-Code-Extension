import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";

export class VsCodeCompileCommandsTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Compile Commands", "compile-commands");
    }

    protected getStringMakeCommand(): string {
        return 'make compile-commands';
    }
}