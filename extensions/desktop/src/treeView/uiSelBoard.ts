import * as vscode from 'vscode';
import { DeviceModel } from '../boards/device';
import { BoardTreeItem } from '../../../../shared/types/boardTreeItem';

export class SelectedBoardTreeItem extends BoardTreeItem{

    public constructor (
        private device : DeviceModel
    ) {
        const labelStr = `${device.getBoardName() ?? 'Unknown board'} `;
        super(labelStr, 'riot-device-board');
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