import { privateDecrypt } from "crypto";
import vscode from "vscode";


export interface DeviceConfig {
    portPath?: string;
    boardName?: string;
    description?: string;
}

export class Device extends vscode.TreeItem {
    
    public label: string;

    public constructor(
        public portPath? : string,

        public boardName? : string,

        public description? : string,
            
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        const labelStr = `${boardName ?? 'Unknown board'}`;
        super(labelStr, collapsibleState);

        this.label = labelStr;
        this.contextValue = 'riot-device';
        this.portPath = portPath;
        this.description = description;
        this.tooltip = `${boardName ?? 'Board not set'}`; 
        
        this.iconPath = new vscode.ThemeIcon('circuit-board');
        this.updateToolTip();
    }

    public setPortPath(newPort : string) {
        this.portPath = newPort;
        this.updateToolTip();
    }

    public setBoard(newBoard : string) {
        this.boardName = newBoard;
        this.label = this.boardName ?? newBoard;  
        this.updateToolTip();
    }

    private updateToolTip() {
        this.tooltip = `${this.boardName ?? 'Board not set'} at ${this.portPath ?? 'Port not set'}`; 
    }

    public toConfig(): DeviceConfig {
        return {
            portPath: this.portPath,
            boardName: this.boardName,
            description: this.description
        };
    }

    public static fromConfig(config: DeviceConfig) {
        return new Device(config.portPath, config.boardName, config.description);
    }
}
