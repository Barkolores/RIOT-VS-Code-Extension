import { DeviceModel } from "../boards/device";
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";

export class VsCodeCompileCommandsTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Compile Commands");
    }

    protected getStringMakeCommand(): string {
        return 'make compile-commands';
    }
}