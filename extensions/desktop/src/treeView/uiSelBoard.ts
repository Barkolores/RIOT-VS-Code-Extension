import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';

export class SelectedBoardTreeItem extends vscode.TreeItem {

    public constructor (
        private device : DeviceModel
    ) {
        const labelStr = `${device.getBoardName() ?? 'Unknown board'} `;
        super(labelStr, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'riot-device-board';
        this.command = {
            command: 'riot-launcher.changeBoardDevice',
            title: 'Change Board',
            arguments: [this]
        };
        
    }

    changeBoard(boardName : string) : void {
        this.device.setBoardName(boardName);
    }

    getDevice() : DeviceModel {
        return this.device;
    }
}