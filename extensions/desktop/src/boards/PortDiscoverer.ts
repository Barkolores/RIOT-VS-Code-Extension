import { SerialPort } from "serialport";
import vscode from "vscode";
import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { BoardTypes } from "../../../../shared/ui/boardTypes";

export class PortDiscovery {


    
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