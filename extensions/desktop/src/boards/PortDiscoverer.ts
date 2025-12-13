import { SerialPort } from "serialport";
import vscode from "vscode";
import { Device } from "../device";
import { BoardRecognizer } from "./BoardRecognizer";

export class PortDiscovery {
    constructor(private recognizer: BoardRecognizer) {}

    public async discoverPorts(): Promise<Device[]> {
        const ports = await SerialPort.list();
        const devises: Device[] = [];
        for(const port of ports) {
            if(port.path.includes('USB') || port.path.includes('COM') || port.path.includes('ACM')) {
                console.log(`Found port: ${port.path}\n VendorId: ${port.vendorId} ProductId: ${port.productId}\n`); 
                const detection = this.recognizer.recognizeBoard(port.vendorId, port.productId, port.serialNumber);
                const boardName = detection ? detection.boardId : 'Unknown Board';
                const description = "";
                const device = new Device(
                    port.path,
                    boardName,
                    description
                );
                devises.push(device);
            }
        }
        return devises;
    }
}