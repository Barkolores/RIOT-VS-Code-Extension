import vscode from "vscode";
import { VsCodeAbstractRiotTask } from "./VsCodeAbstractRiotTask";
import { DeviceModel } from '../../../../shared/ui/deviceModel';

export abstract class VsCodeAbstractRiotDeviceTask extends VsCodeAbstractRiotTask{

    constructor(
        applicationPath: string,
        device: DeviceModel,
        taskName : string
    ) {
        super(applicationPath, device, taskName);
    }

    protected getStringShellCommand(): string {
        const cDir = `cd ${this.applicationPath}`;
        const makeCommand = this.getStringMakeCommand();
                var shellCommand = 
            `cd ${this.applicationPath} && ${makeCommand} BOARD=${this.device.board?.id ?? 'native64'}`;
        if(this.device.portPath) {
            shellCommand.concat(`PORT=${this.device.portPath ?? ''}`);
        }
        return shellCommand;
    }

    protected abstract getStringMakeCommand() : string;
}
