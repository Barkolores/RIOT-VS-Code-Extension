import {WebDevice, webPort} from "./webDevice";
import {SerialDevice} from "./serial/serialDevice";
import {DeviceProvider} from "shared/ui/deviceProvider";
import vscode from "vscode";
import {inboundDeviceMessage} from "../websocket/api/inbound/inboundDeviceMessage";
import {outboundDeviceMessage} from "../websocket/api/outbound/outboundDeviceMessage";
import {
    addressTypes,
    clientAddress,
    messageTypes,
    shellAddress,
    terminationTypes
} from "../websocket/api/additionalTypes";
import {EspDevice} from "./serial/espDevice";
import {espBoards, nrfBoards, serialBoards} from "./supportedBoards";
import {NrfDevice} from "./serial/nrfDevice";

export class DeviceManager {
    private _devices: WebDevice[] = [];

    constructor(
        private _devicesProvider: DeviceProvider,
        private _messagePort: MessagePort,
    ) {
        //discard Devices on reload
        navigator.serial.getPorts().then((ports) => {
            ports.forEach((port) => {port.forget();});
        });
    }

    checkLabelAvailable(newLabel: string, excludeLabel?: string): boolean {
        for (const device of Object.values(this._devices)) {
            if (newLabel === device.label && newLabel !== excludeLabel) {
                return false;
            }
        }
        return true;
    }

    private getNextDefaultLabel(): string {
        let counter = 1;
        while (true) {
            const newLabel = 'Device' + counter++;
            if (this.checkLabelAvailable(newLabel)) {
                return newLabel;
            }
        }
    }

    async addDevice(board: string) {
        let newDevice: WebDevice | undefined = undefined;
        let newDeviceId: string | undefined = undefined;
        while (true) {
            //get new Unique Id
            newDeviceId = crypto.randomUUID();
            if (!(newDeviceId in this._devices)) {
                break;
            }
        }
        const newLabel = this.getNextDefaultLabel();
        if (serialBoards.includes(board)) {
            //Add Serial Device
            let serialPort: SerialPort | undefined;
            await vscode.commands.executeCommand("workbench.experimental.requestSerialPort");
            for (const port of await navigator.serial.getPorts()) {
                if (this.includesPort(port) === undefined) {
                    serialPort = port;
                    break;
                }
            }
            if (!serialPort) {
                vscode.window.showErrorMessage('This serial port is already in use');
                return;
            }
            (serialPort as SerialPort & {used: boolean}).used = true;
            switch (true) {
                case espBoards.includes(board):
                    //esp boards with flasher esptool.js
                    newDevice = new EspDevice(newLabel, newDeviceId, board, serialPort, this._messagePort);
                    break;
                case nrfBoards.includes(board):
                    //nrf boards with flasher rnode flasher
                    newDevice = new NrfDevice(newLabel, newDeviceId, board, serialPort, this._messagePort);
                    if (!await (newDevice as NrfDevice).init()) {
                        return;
                    }
                    break;
                default:
                    //serial boards without flasher
                    newDevice = new SerialDevice(newLabel, newDeviceId, undefined, serialPort, this._messagePort);
                    break;
            }
        // } else if (usbBoards.includes(board)) {
        //     //Add USB Device
        //     return;
        } else {
            vscode.window.showErrorMessage('Board is not in supported boards declaration.');
            return;
        }

        this._devices.push(newDevice);
        vscode.window.showInformationMessage('New Device with label "'+ newLabel +'" added');
        this.updateDeviceProvider();
    }

    private includesPort(port: webPort): number | undefined {
        for (let i = 0; i < this._devices.length; i++) {
            if (this._devices[i].comparePort(port)) {
                return i;
            }
        }
        return undefined;
    }

    handleDisconnectEvent(port: webPort) {
        const id = this.includesPort(port);
        if (id === undefined) {
            return;
        }
        const disconnectedDevice = this._devices[id];
        this._devices.splice(id, 1);
        vscode.window.showInformationMessage('Device "'+ disconnectedDevice.label +'" has been disconnected');
        this.updateDeviceProvider();
    }

    removeDevice(device: WebDevice) {
        device.forget();
        this._devices.splice(this._devices.indexOf(device), 1);
        this.updateDeviceProvider();
    }

    //use when TreeItems change (e.g. label)
    refreshDeviceProvider() {
        this._devicesProvider.refresh();
    }

    //use when TreeItems are added or removed, or when sorting TreeItems
    updateDeviceProvider() {
        const devices = Object.values(this._devices).sort((device1, device2) => {
            return (device1.label as string).localeCompare(device2.label as string);
        });
        this._devicesProvider.setDevices(devices);
        this.refreshDeviceProvider();
    }

    handleMessage(message: inboundDeviceMessage) {
        let requestedDevice: WebDevice | undefined = undefined;
        const deviceName = message[2][1];
        for (const device of this._devices) {
            if (device.label === deviceName) {
                requestedDevice = device;
                break;
            }
        }
        if (requestedDevice === undefined) {
            this.sendErrorRST(message[1][1], `No Device with the label '${deviceName}' is known.`);
            return;
        }
        requestedDevice.handleMessage(message);
    }

    private sendErrorRST(shellId: number , reason: string) {
        //send RST when Device is not found
        this._messagePort.postMessage([
            messageTypes.RST,
            [addressTypes.CLIENT, 0] as clientAddress,
            [addressTypes.SHELL, shellId] as shellAddress,
            terminationTypes.ERROR,
            reason
        ] as outboundDeviceMessage);
    }

    cancelAllDeviceActions() {
        for (const device of Object.values(this._devices)) {
            device.cancel();
        }
    }

    //removes all disconnected Devices from UI and unused connected Devices (from all used APIs)
    async cleanUp() {
        for (const port of await navigator.serial.getPorts()) {
            if (this.includesPort(port) === undefined) {
                await port.forget();
            }
            if (!port.connected) {
                this.handleDisconnectEvent(port);
                await port.forget();
            }
        }
    }

    //finds the device that is locked to the terminal and cancels all actions
    handleClosedTerminal(processId: number) {
        for (const device of this._devices) {
            if (processId === device.getShellId()) {
                device.cancel(false);
            }
        }
    }
}