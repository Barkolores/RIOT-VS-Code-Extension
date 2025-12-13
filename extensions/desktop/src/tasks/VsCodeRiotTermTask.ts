import { Device } from "../device";
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";


export class VsCodeRiotTermTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : Device
    ) {
        super(applicationPath, device, "RIOT Term");
    }

    protected getStringMakeCommand(): string {
        return 'make term';
    }
}