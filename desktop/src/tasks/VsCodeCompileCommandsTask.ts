import { Device } from "../device";
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";

export class VsCodeCompileCommandsTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : Device
    ) {
        super(applicationPath, device, "RIOT Compile Commands");
    }

    protected getStringMakeCommand(): string {
        return 'make compile-commands';
    }
}