import * as vscode from 'vscode';
import {DeviceTreeItem} from "./deviceTreeItem";
import { DeviceModel } from '../deviceModel';
import { BoardTypes } from '../boardTypes';

export class BoardTreeItem extends vscode.TreeItem {
    constructor(
        protected readonly _device: DeviceModel,
    ) {
        const board = _device.board;
        super((board ? board.name : 'Unknown board'), vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'boardItem'
    }

    getDevice(): DeviceModel {
        return this._device;
    }

    changeBoard(board : BoardTypes) : void {
        this._device.board = board;
    }
}