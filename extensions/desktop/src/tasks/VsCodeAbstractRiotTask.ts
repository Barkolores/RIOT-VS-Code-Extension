import vscode from "vscode";
import { AbstractRiotTask } from "./AbstractRiotTask";
import { DeviceModel } from "../boards/device";

export abstract class VsCodeAbstractRiotTask extends AbstractRiotTask{

    constructor(
        applicationPath: string,
        device: DeviceModel,
        taskName : string
    ) {
        super(applicationPath, device, taskName);
    }

    protected internalCreateTask(): vscode.Task {
        const command = this.getStringShellCommand();
        var shellCommand = new vscode.ShellExecution(
            command
        );
        console.log(this.taskName);
        return new vscode.Task(
            { type: 'riotTaskProvider' },
            vscode.TaskScope.Workspace,
            this.taskName,
            'riot-launcher',
            shellCommand
        );
    }

    /* Template method returns command to execute in application folder*/ 
    protected abstract getStringShellCommand(): string;

}
