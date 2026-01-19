import vscode from "vscode";
import { AbstractRiotTask } from "./AbstractRiotTask";
import { DeviceModel } from '../../../../shared/ui/deviceModel';

export abstract class VsCodeAbstractRiotTask extends AbstractRiotTask{

    constructor(
        applicationPath: string,
        device: DeviceModel,
        taskTitle : string,
        protected taskMode : string
    ) {
        super(applicationPath, device, taskTitle);
    }

    protected internalCreateTask(): vscode.Task {
        const definition: vscode.TaskDefinition = {
            type : 'riot-launcher',
            board : this.device.board?.id,
            mode : this.taskMode
        };

        const command = this.getStringShellCommand();
        var shellCommand = new vscode.ShellExecution(
            command
        );
        console.log(this.taskName);
        return new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            this.taskName,
            'riot-launcher',
            shellCommand
        );
    }

    /* Template method returns command to execute in application folder*/ 
    protected abstract getStringShellCommand(): string;

}
