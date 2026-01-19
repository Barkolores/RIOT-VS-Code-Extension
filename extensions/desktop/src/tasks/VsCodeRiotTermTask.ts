import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";


export class VsCodeRiotTermTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Term", "term");
    }

    protected getStringMakeCommand(): string {
        return 'make term';
    }
}