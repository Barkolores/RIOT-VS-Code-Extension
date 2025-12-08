import {WebDevice, type Port} from "./webDevice";
import {SerialDevice} from "./serialDevice";
import {DevicesProvider} from "../providers/devicesProvider";

export class DeviceManager {
    private _devices: WebDevice[] = [];
    private _counter: number = 1;
    constructor(
        private _devicesProvider: DevicesProvider
    ) {
        //initialize Devices
        navigator.serial.getPorts().then((ports) => {
            for (const port of ports) {
                this._devices.push(new SerialDevice(port, crypto.randomUUID(), this._counter++, this._devicesProvider.onDidChangeTreeDataEventEmitter));
            }
            this.updateDevicesProvider();
        });
    }

    private includesPort(port: Port): number | undefined {
        for (const device of this._devices) {
            if (device.comparePort(port)) {
                return this._devices.indexOf(device);
            }
        }
        return;
    }

    checkForAddedDevice() {
        navigator.serial.getPorts().then((ports) => {
            let newDeviceFound = false;
            for (const port of ports) {
                if (this.includesPort(port) === undefined) {
                    this._devices.push(new SerialDevice(port, crypto.randomUUID(), this._counter++, this._devicesProvider.onDidChangeTreeDataEventEmitter));
                    newDeviceFound = true;
                }
            }
            if (newDeviceFound) {
                this.updateDevicesProvider();
            }
        });
    }

    handleConnectEvent(port: Port) {
        const index = this.includesPort(port);
        if (index !== undefined) {
            return;
        }
        if (port instanceof SerialPort) {
            this._devices.push(new SerialDevice(port, crypto.randomUUID(), this._counter++, this._devicesProvider.onDidChangeTreeDataEventEmitter));
        }
        this.updateDevicesProvider();
    }

    handleDisconnectEvent(port: Port): string | undefined {
        const index = this.includesPort(port);
        if (index === undefined) {
            return;
        }
        const uuid: string = this._devices.splice(index, 1)[0].contextValue;
        this.updateDevicesProvider();
        return uuid;
    }

    removeDevice(device: WebDevice) {
        device.forget();
        this._devices.splice(this._devices.indexOf(device), 1);
        this.updateDevicesProvider();
    }

    refreshDevicesProvider() {
        this._devicesProvider.refresh();
    }

    private updateDevicesProvider() {
        this._devicesProvider.setDevices(this._devices);
        this.refreshDevicesProvider();
    }
}