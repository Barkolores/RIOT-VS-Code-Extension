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
            
    ) {
        const labelStr = `${boardName ?? 'Unknown board'}`;
        this.portPath = portPath;
        this.description = description;
        // this.tooltip = `${boardName ?? 'Board not set'}`; 
        
        // this.iconPath = new vscode.ThemeIcon('circuit-board');
        // this.updateToolTip();
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
}
