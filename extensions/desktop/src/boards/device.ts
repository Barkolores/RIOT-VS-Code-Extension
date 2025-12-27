import vscode from "vscode";


export interface DeviceConfig {
    portPath?: string;
    boardName?: string;
    description?: string;
}

export class DeviceModel {
    
    public constructor(
        private portPath? : string,

        private boardName? : string,

        private description? : string,
            
        private appPath?: string,

        private riotBasePath?: string
    ) {
        const labelStr = `${boardName ?? 'Unknown board'}`;
    }

    // public setPortPath(newPort : string) {
    //     this.portPath = newPort;
    //     this.updateToolTip();
    // }

    // public setBoard(newBoard : string) {
    //     this.boardName = newBoard;
    //     this.label = this.boardName ?? newBoard;  
    //     this.updateToolTip();
    // }

    public toConfig(): DeviceConfig {
        return {
            portPath: this.portPath,
            boardName: this.boardName,
            description: this.description
        };
    }

    public static fromConfig(config: DeviceConfig) {
        return new DeviceModel(config.portPath, config.boardName, config.description);
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

    public getAppPath() : string | undefined {
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

    public setAppPath(appPath : string) : void {
        this.appPath = appPath;
    }

    public getRiotBasePath() : string | undefined {
        return this.riotBasePath;
    }

    public setRiotBasePath(riotBasePath : string) : void {
        this.riotBasePath = riotBasePath;
    }

}
