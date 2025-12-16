import { DeviceModel } from "../boards/device";
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";


export class VsCodeRiotTermTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Term");
    }

    protected getStringMakeCommand(): string {
        return 'make term';
    }
}