import vscode, { Uri } from "vscode";


export interface DeviceConfig {
    portPath?: string;
    boardName?: string;
    description?: string;
    appPath?: string;
    riotBasePath?: string
}

export class DeviceModel {
    
    public constructor(
        private portPath? : string,

        private boardName? : string,

        private description? : string,
            
        private appPath?: vscode.Uri,

        private riotBasePath?: vscode.Uri
    ) {}

    public toConfig(): DeviceConfig {
        return {
            portPath: this.portPath,
            boardName: this.boardName,
            description: this.description,
            appPath: this.appPath?.fsPath,
            riotBasePath: this.riotBasePath?.fsPath
        };
    }

    public static fromConfig(config: DeviceConfig) {
        const appUri = config.appPath ? Uri.file(config.appPath) : undefined;
        const riotBaseUri = config.riotBasePath ? Uri.file(config.riotBasePath) : undefined;
        return new DeviceModel(config.portPath, config.boardName, config.description, appUri, riotBaseUri);
    }

    public getPortPath() : string | undefined {
        return this.portPath;
    }

    public getBoardName() : string | undefined {
        return this.boardName;
    }

    public getDescription() : string | undefined {
        return this.description;
    }

    public getAppPath() : Uri | undefined {
        return this.appPath;
    }

    public setPortPath(portPath: string | undefined) : void {
        this.portPath = portPath;
    }

    public setBoardName(boardName : string): void {
        this.boardName = boardName;
    }

    public setDescription(description : string): void {
        this.description = description;
    }

    public setAppPath(appPath : Uri) : void {
        this.appPath = appPath;
    }

    public getRiotBasePath() : Uri | undefined {
        return this.riotBasePath;
    }

    public setRiotBasePath(riotBasePath : Uri) : void {
        this.riotBasePath = riotBasePath;
    }

}
