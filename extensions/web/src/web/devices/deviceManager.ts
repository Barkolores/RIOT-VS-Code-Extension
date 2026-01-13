import {WebDevice} from "./webDevice";
import {webPort} from "./webPort";
import {SerialDevice} from "./serial/serialDevice";
import {DeviceProvider} from "shared/ui/deviceProvider";
import vscode from "vscode";

export class DeviceManager {
    private _devices: WebDevice[] = [];
    private _counter: number = 1;
    constructor(
        private _devicesProvider: DeviceProvider
    ) {
        //initialize Devices
        navigator.serial.getPorts().then((ports) => {
            for (const port of ports) {
                this._devices.push(this.deviceGenerator(port));
            }
            this.updateDeviceProvider();
        });
    }

    private includesPort(port: webPort): number | undefined {
        for (const device of this._devices) {
            if (device.comparePort(port)) {
                return this._devices.indexOf(device);
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
                    this._devices.push(newDevice);
                    vscode.window.showInformationMessage('New Device with label "'+ newDevice.label +'" added');
                    newDeviceFound = true;
                }
            }
            if (newDeviceFound) {
                this.sortDevices();
            }
        });
    }

    handleConnectEvent(port: webPort) {
        const index = this.includesPort(port);
        if (index !== undefined) {
            return;
        }
        if (port instanceof SerialPort) {
            const connectedDevice = this.deviceGenerator(port);
            this._devices.push(this.deviceGenerator(port));
            vscode.window.showInformationMessage('New device with label "'+ connectedDevice.label +'" has been connected');
        }
        this.sortDevices();
    }

    handleDisconnectEvent(port: webPort) {
        const index = this.includesPort(port);
        if (index === undefined) {
            return;
        }
        const disconnectedDevice = this._devices.splice(index, 1)[0];
        vscode.window.showInformationMessage('Device "'+ disconnectedDevice.label +'" has been disconnected');
        this.updateDeviceProvider();
    }

    removeDevice(device: WebDevice) {
        device.forget();
        this._devices.splice(this._devices.indexOf(device), 1);
        this.updateDeviceProvider();
    }

    refreshDeviceProvider() {
        this._devicesProvider.refresh();
    }

    private deviceGenerator(port: SerialPort): WebDevice {
        return new SerialDevice(port, crypto.randomUUID(), this.getNextDefaultLabel(), this._devicesProvider.onDidChangeTreeDataEventEmitter);
    }

    private updateDeviceProvider() {
        this._devicesProvider.setDevices(this._devices);
        this.refreshDeviceProvider();
    }

    checkLabelAvailable(newLabel: string, excludeLabel?: string): boolean {
        for (const device of this._devices) {
            if (newLabel === device.label && newLabel !== excludeLabel) {
                return false;
            }
        }
        return true;
    }

    private getNextDefaultLabel(): string {
        // while (true) {
        //     const newLabel = 'Device ' + this._counter++;
        //     if (this.checkLabelAvailable(newLabel)) {
        //         return newLabel;
        //     }
        // }
        let counter = 1;
        while (true) {
            const newLabel = 'Device ' + counter++;
            if (this.checkLabelAvailable(newLabel)) {
                return newLabel;
            }
        }
    }

    sortDevices() {
        this._devices = this._devices.sort((device1, device2) => {
            return (device1.label as string).localeCompare(device2.label as string);
        });
        this.updateDeviceProvider();
    }
}