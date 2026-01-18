import vscode from "vscode";
import { DeviceModel } from '../../../../shared/ui/deviceModel';


export abstract class AbstractRiotTask {
    protected task : vscode.Task | undefined = undefined;

    constructor(
        public readonly applicationPath: string,

        public readonly device : DeviceModel,

        protected readonly taskName: string,
    ) {
        this.task = this.internalCreateTask();
    }

    protected abstract internalCreateTask() : vscode.Task;

    public getVscodeTask() : vscode.Task | undefined {
        return this.task;
    }

}