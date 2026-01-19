import vscode from "vscode";
import { DeviceModel } from '../../../../shared/ui/deviceModel';


export abstract class AbstractRiotTask {

    constructor(
        public readonly applicationPath: string,

        public readonly device : DeviceModel,

        protected readonly taskName: string,
    ) {}

    protected abstract internalCreateTask() : vscode.Task;

    public getVscodeTask() : vscode.Task | undefined {
        return this.internalCreateTask();
    }

}