import vscode from "vscode";
import { VsCodeAbstractRiotTask } from "./VsCodeAbstractRiotTask";
import { DeviceModel } from "../boards/device";

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
            `cd ${this.applicationPath} && ${makeCommand} BOARD=${this.device.getBoardName() ?? 'native64'}`;
        if(this.device.getPortPath()) {
            shellCommand.concat(`PORT=${this.device.getPortPath ?? ''}`);
        }
        return shellCommand;
    }

    protected abstract getStringMakeCommand() : string;
}
