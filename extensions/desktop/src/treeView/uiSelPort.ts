import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';

export class SelectedPortTreeItem extends vscode.TreeItem {

    public constructor (
        private device : DeviceModel
    ) {
        const labelStr = `${device.getPortPath() ?? 'Port: None'} `;
        super(labelStr, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'riot-device-port';
        this.command = {
            command: 'riot-launcher.changePortDevice',
            title: 'Change Port',
            arguments: [this]
        };
        
    }

    changePortPath(portPath : string) : void {
        this.device.setPortPath(portPath === 'None' ? undefined : portPath);
    }

    getPortPath() : string | undefined {
        return this.device.getPortPath();
    }

}