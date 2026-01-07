import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';
import { PortTreeItem } from '../../../../shared/types/portTreeItem';


export class SelectedPortTreeItem extends PortTreeItem {
    

    public constructor (
        private device : DeviceModel
    ) {
        const labelStr = `${device.getPortPath() ?? 'Port: None'} `;
        super(labelStr, 'riot-device-port');
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

    changePort(portPath?: string, param?: object): void {
        if(portPath) {
            this.device.setPortPath(portPath);
        }
    }

}