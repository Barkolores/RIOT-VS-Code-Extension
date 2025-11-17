import {Device, type Port} from "./device";
import {SerialDevice} from "./serialDevice";
import {DevicesProvider} from "../providers/devicesProvider";

export class DeviceManager {
    private _devices: Device[] = [];

    constructor(
        private _devicesProvider: DevicesProvider
    ) {
        //initialize Devices
        navigator.serial.getPorts().then((ports) => {
            for (const port of ports) {
                this._devices.push(new SerialDevice(port, crypto.randomUUID()));
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
                    this._devices.push(new SerialDevice(port, crypto.randomUUID()));
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
            this._devices.push(new SerialDevice(port, crypto.randomUUID()));
        }
        this.updateDevicesProvider();
    }

    handleDisconnectEvent(port: Port) {
        const index = this.includesPort(port);
        if (index === undefined) {
            return;
        }
        this._devices.splice(index, 1);
        this.updateDevicesProvider();
    }

    removeDevice(device: Device) {
        device.forget();
        this._devices.splice(this._devices.indexOf(device), 1);
        this.updateDevicesProvider();
    }

    private updateDevicesProvider() {
        this._devicesProvider.refresh(this._devices);
    }
}