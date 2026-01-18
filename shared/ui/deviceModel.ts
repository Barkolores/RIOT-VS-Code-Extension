import vscode, { Uri } from "vscode";
import { BoardTypes } from "./boardTypes";



export interface DeviceConfig {
    portPath?: string;
    board?: string;
    title?: string;
    appPath?: string;
    riotBasePath?: string;
    description?: string[]
}

export class DeviceModel {
    
    public constructor(
        public portPath? : string,

        public board? : BoardTypes,

        public title? : string,
            
        public appPath?: vscode.Uri,

        public riotBasePath?: vscode.Uri,

        public description?: string[]
    ) {}

    public toConfig(): DeviceConfig {
        return {
            portPath: this.portPath,
            board: this.board?.id,
            title: this.title,
            appPath: this.appPath?.fsPath,
            riotBasePath: this.riotBasePath?.fsPath,
            description: this.description
        };
    }

    public static fromConfig(config: DeviceConfig) {
        const appUri = config.appPath ? Uri.file(config.appPath) : undefined;
        const riotBaseUri = config.riotBasePath ? Uri.file(config.riotBasePath) : undefined;
        let board : BoardTypes | undefined;
        if(config.board) {
            board = { id : config.board, name : config.board };
        }
        return new DeviceModel(config.portPath, board, config.title, appUri, riotBaseUri);
    }

    public getFolder () : vscode.WorkspaceFolder | undefined {
        if(this.appPath) {
            return vscode.workspace.getWorkspaceFolder(this.appPath);
        }
        return undefined;
    }

}