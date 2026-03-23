import { DeviceModel } from '../treeView/deviceModel';
import { VsCodeAbstractRiotDeviceTask } from "./VsCodeAbstractRiotDeviceTask";

export class VsCodeRiotBuildTask extends VsCodeAbstractRiotDeviceTask {

    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Build", "build");
    }

    protected getStringMakeCommand(): string {
        return 'make all';
    }
}