import { Device } from "../../../../shared/types/device";
import { DeviceModel } from "../boards/device";
import * as vscode from 'vscode';

export interface DeviceDesktopTreeItem {

    device: DeviceModel;

    getDevice() : DeviceModel;

}