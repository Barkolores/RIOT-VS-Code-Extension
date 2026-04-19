import { DeviceModel } from '../treeView/deviceModel';
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";


export class VsCodeRiotCleanTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Clean", "clean");
    }

    protected getStringMakeCommand(): string {
        return 'clean';
    }
}