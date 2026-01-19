import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { VsCodeAbstractRiotDeviceTask } from './VsCodeAbstractRiotDeviceTask';

export class VsCodeRiotDebugTask extends VsCodeAbstractRiotDeviceTask {
    
    constructor (
        applicationPath: string,
        device : DeviceModel
    ) {
        super(applicationPath, device, "RIOT Debug", "debug");
    }

    protected getStringMakeCommand(): string {
        return 'make all && make debug-server';
    }   

}
