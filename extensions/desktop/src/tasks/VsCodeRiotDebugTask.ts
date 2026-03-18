import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { VsCodeAbstractRiotDeviceTask } from './VsCodeAbstractRiotDeviceTask';

export class VsCodeRiotDebugTask extends VsCodeAbstractRiotDeviceTask {
    
    constructor (
        applicationPath: string,
        device : DeviceModel,
        private gdbPort: number,
        private telnetPort: number,
        private tclPort: number
    ) {
        super(applicationPath, device, "RIOT Debug", "debug");
    }

    protected getStringMakeCommand(): string {
        return 'make all && make debug-server GDB_PORT=' + this.gdbPort + ' TELNET_PORT=' + this.telnetPort + ' TCL_PORT=' + this.tclPort;
    }   

}
