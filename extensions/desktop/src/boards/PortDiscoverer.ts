import { SerialPort } from "serialport";
import vscode from "vscode";
import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { BoardRecognizer } from "./BoardRecognizer";
import { BoardTypes } from "../../../../shared/ui/boardTypes";

export class PortDiscovery {
    constructor(private recognizer?: BoardRecognizer) {}

    public async discoverDevicePorts(): Promise<DeviceModel[]> {
        if(!this.recognizer) {
            return[];
        }
        const ports = await SerialPort.list();
        const devises: DeviceModel[] = [];
        for(const port of ports) {
            if(port.path.includes('USB') || port.path.includes('COM') || port.path.includes('ACM')) {
                console.log(`Found port: ${port.path}\n VendorId: ${port.vendorId} ProductId: ${port.productId}\n`); 
                const detection = this.recognizer.recognizeBoard(port.vendorId, port.productId, port.serialNumber);
                const boardName = detection ? detection.boardId : undefined;
                let board : BoardTypes | undefined;
                if(boardName){
                    board = {id : boardName, name: boardName};
                }
                const description = "";
                const device = new DeviceModel(
                    port.path,
                    board,
                    description
                );
                devises.push(device);
            }
        }
        return devises;
    }

    public async discoverPorts(): Promise<string[]> {
        const ports = await SerialPort.list();
        const portPaths: string[] = [];
        for(const port of ports) {
            if(port.path.includes('USB') || port.path.includes('COM') || port.path.includes('ACM')) {
                portPaths.push(port.path);
            }
        }
        return portPaths;
    }
}