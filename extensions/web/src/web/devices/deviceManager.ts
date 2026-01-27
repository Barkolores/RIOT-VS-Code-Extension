import {WebDevice} from "./webDevice";
import {webPort} from "./webPort";
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

export class DeviceManager {
    private _devices: {[id: string]: WebDevice} = {};
    private _randomArray = new Uint32Array(1);

    constructor(
        private _devicesProvider: DeviceProvider,
        private _messagePort: MessagePort,
    ) {
        //initialize Devices
        navigator.serial.getPorts().then((ports) => {
            for (const port of ports) {
                const newDevice = this.deviceGenerator(port);
                this._devices[newDevice.contextValue] = newDevice;
            }
            this.updateDeviceProvider();
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
            const newLabel = 'Device ' + counter++;
            if (this.checkLabelAvailable(newLabel)) {
                return newLabel;
            }
        }
    }

    private deviceGenerator(port: SerialPort): WebDevice {
        //TESTING
        let newDeviceId: string | undefined = '20';
        // while (true) {
        //     //get new Unique Id
        //     newDeviceId = crypto.getRandomValues(this._randomArray)[0].toString();
        //     if (!(newDeviceId in this._devices)) {
        //         break;
        //     }
        // }
        const newDevice = new SerialDevice(port, newDeviceId, this.getNextDefaultLabel(), this._devicesProvider.onDidChangeTreeDataEventEmitter, this._messagePort);
        this._devices[newDeviceId] = newDevice;
        return newDevice;
    }

    private includesPort(port: webPort): string | undefined {
        for (const device of Object.values(this._devices)) {
            if (device.comparePort(port)) {
                return device.contextValue;
            }
        }
        return;
    }

    checkForAddedDevices() {
        navigator.serial.getPorts().then((ports) => {
            let newDeviceFound = false;
            for (const port of ports) {
                if (this.includesPort(port) === undefined) {
                    const newDevice = this.deviceGenerator(port);
                    vscode.window.showInformationMessage('New Device with label "'+ newDevice.label +'" added');
                    newDeviceFound = true;
                }
            }
            if (newDeviceFound) {
                this.updateDeviceProvider();
            }
        });
    }

    handleConnectEvent(port: webPort) {
        const index = this.includesPort(port);
        if (index !== undefined) {
            return;
        }
        if (port instanceof SerialPort) {
            const newDevice = this.deviceGenerator(port);
            vscode.window.showInformationMessage('New device with label "'+ newDevice.label +'" has been connected');
        }
        this.updateDeviceProvider();
    }

    handleDisconnectEvent(port: webPort) {
        const id = this.includesPort(port);
        if (id === undefined) {
            return;
        }
        const disconnectedDevice = this._devices[id];
        delete this._devices[id];
        vscode.window.showInformationMessage('Device "'+ disconnectedDevice.label +'" has been disconnected');
        this.updateDeviceProvider();
    }

    removeDevice(device: WebDevice) {
        device.forget();
        delete this._devices[device.contextValue];
        this.updateDeviceProvider();
    }

    //use when TreeItems change (e.g. label)
    refreshDeviceProvider() {
        this._devicesProvider.refresh();
    }

    //use when TreeItems should are added or removed, or when sorting TreeItems
    updateDeviceProvider() {
        const devices = Object.values(this._devices).sort((device1, device2) => {
            return (device1.label as string).localeCompare(device2.label as string);
        });
        this._devicesProvider.setDevices(devices);
        this.refreshDeviceProvider();
    }

    handleMessage(message: inboundDeviceMessage) {
        let requestedDevice: WebDevice | undefined = undefined;
        if (message[0] === messageTypes.DNR) {
            //Device Name Resolution
            const deviceName = message[2];
            for (const device of Object.values(this._devices)) {
                if (device.label === deviceName) {
                    requestedDevice = device;
                    break;
                }
            }
            if (requestedDevice === undefined) {
                this.sendErrorLTM(message[1][1], `No Device with the label '${deviceName}' is known.`);
                return;
            }
        } else {
            //Forward to device id
            const deviceId = message[2][1];
            if (deviceId in this._devices) {
                requestedDevice = this._devices[deviceId];
            } else {
                this.sendErrorLTM(message[1][1], `No Device with the id ${deviceId} is known.`);
                return;
            }
        }
        requestedDevice.handleMessage(message);
    }

    private sendErrorLTM(shellId: number , reason: string) {
        //send LTM when Device is not found
        this._messagePort.postMessage([
            messageTypes.LTM,
            [addressTypes.CLIENT, 0] as clientAddress,
            [addressTypes.SHELL, shellId] as shellAddress,
            terminationTypes.ERROR,
            reason
        ] as outboundDeviceMessage);
    }

    cancelAllDeviceActions() {
        console.log('Cancelling all device actions...');
        for (const device of Object.values(this._devices)) {
            device.cancel();
        }
    }
}