import {SerialDevice} from "./serialDevice";
import {FlashInterface} from "../flash/flashInterface";
import vscode from "vscode";
//@ts-ignore
import zip from "../../tools/zip.min.js";

export class NrfDevice extends SerialDevice implements FlashInterface{

    /**
     * A Web Serial based nRF52 flasher written by liam@liamcottle.com based on dfu_transport.serial.py
     * https://github.com/adafruit/Adafruit_nRF52_nrfutil/blob/master/nordicsemi/dfu/dfu_transport_serial.py
     */

    DFU_TOUCH_BAUD = 1200;
    SERIAL_PORT_OPEN_WAIT_TIME = 0.1;
    TOUCH_RESET_WAIT_TIME = 1.5;

    FLASH_BAUD = 115200;

    HEX_TYPE_APPLICATION = 4;

    DFU_INIT_PACKET = 1;
    DFU_START_PACKET = 3;
    DFU_DATA_PACKET = 4;
    DFU_STOP_DATA_PACKET = 5;

    DATA_INTEGRITY_CHECK_PRESENT = 1;
    RELIABLE_PACKET = 1;
    HCI_PACKET_TYPE = 14;

    FLASH_PAGE_SIZE = 4096;
    FLASH_PAGE_ERASE_TIME = 0.0897;
    FLASH_WORD_WRITE_TIME = 0.000100;
    FLASH_PAGE_WRITE_TIME = (this.FLASH_PAGE_SIZE/4) * this.FLASH_WORD_WRITE_TIME;

    // The DFU packet max size
    DFU_PACKET_MAX_SIZE = 512;

    private sequenceNumber;
    private total_size;

    constructor(label: string,
                contextValue: string,
                board: string,
                serialPort: SerialPort,
                dmPort: MessagePort
    ) {
        super(label, contextValue, board, serialPort, dmPort);
        this.sequenceNumber = 0;
        this.total_size = 0;
    }

    async init(): Promise<boolean> {
        await this.enterDfuMode();
        if ((this._webPort as SerialPort).connected) {
            //device was already in DFU mode
            const result = await vscode.window.showInformationMessage('Device is already in DFU mode. Please press the reset button or reconnect the device first. Then grant access to it again.', {modal: true}, 'Grant Access');
            if ((this._webPort as SerialPort).connected || !result) {
                vscode.window.showErrorMessage((result ? 'Device has not been reset. ' : '') + 'Aborting...');
                await this._webPort.forget();
                return false;
            }
            await vscode.commands.executeCommand("workbench.experimental.requestSerialPort");
            await this.rediscoverPort();
            return true;
        } else {
            //device was in non DFU mode
            //grant access to DFU mode
            if (!await vscode.window.showInformationMessage('Device has been put into DFU mode. Please grant access to it again.', {modal: true}, 'Grant Access')) {
                return false;
            }
            await vscode.commands.executeCommand("workbench.experimental.requestSerialPort");
            await this.rediscoverPort();
            await vscode.commands.executeCommand('riot-web-extension.eventListener.lock');
            const result = await vscode.window.showInformationMessage('Device access has been granted. Please reset or reconnect the device.', {modal: true}, 'Done');
            await vscode.commands.executeCommand('riot-web-extension.eventListener.unlock');
            if ((this._webPort as SerialPort).connected || !result) {
                vscode.window.showErrorMessage('Device has not been reset. Aborting.');
                await this._webPort.forget();
                return false;
            }
            await this.rediscoverPort();
            return true;
        }
    }

    async rediscoverPort() {
        console.log('starting rediscover');
        let has_found = false;
        while (true) {
            (await navigator.serial.getPorts()).forEach((serialPort) => {
                if (!('used' in serialPort)) {
                    has_found = true;
                    (serialPort as SerialPort & {used: boolean}).used = true;
                    this._webPort = serialPort;
                    console.log('found');
                }
            });
            if (has_found) {
                break;
            }
            await vscode.window.showErrorMessage('Physical Device could not be rediscovered. Please grant access to the device again.', {modal: true});
            await vscode.commands.executeCommand('workbench.experimental.requestSerialPort');
        }
        console.log('ending rediscover');
    }

    /**
     * Waits for the provided milliseconds, and then resolves.
     * @param millis
     * @returns {Promise<void>}
     */
    async sleepMillis(millis: number) {
        await new Promise((resolve) => {
            setTimeout(resolve, millis);
        });
    }

    /**
     * Writes the provided data to the Serial Port.
     * @param data
     * @returns {Promise<void>}
     */
    async sendPacket(data: number[]) {
        const writer = (this._webPort as SerialPort).writable?.getWriter();
        if (!writer) {
            throw Error('Writer not accessible');
        }
        try {
            await writer.write(new Uint8Array(data));
        } finally {
            writer.releaseLock();
        }
    }

    /**
     * Puts an nRF52 board into DFU mode by quickly opening and closing a serial port.
     * @returns {Promise<void>}
     */
    async enterDfuMode() {
        console.log('starting dfu enter');
        // open port
        await this._webPort.open({
            baudRate: this.DFU_TOUCH_BAUD,
        });

        // wait SERIAL_PORT_OPEN_WAIT_TIME before closing port
        await this.sleepMillis(this.SERIAL_PORT_OPEN_WAIT_TIME * 1000);

        // close port
        await this._webPort.close();

        // wait TOUCH_RESET_WAIT_TIME for device to enter into DFU mode
        await this.sleepMillis(this.TOUCH_RESET_WAIT_TIME * 1000);
        console.log('ending dfu enter');
    }

    /**
     * Flashes the provided firmware zip.
     * @returns {Promise<void>}
     */
    async flash(binaries: {[offset:string]: Uint8Array}, args: string) {

        const binary = Object.values(binaries)[0];

        const updates = new Blob([new Uint8Array(new Uint32Array([binary.length]).buffer), new Uint8Array(binary)]);

        const progressCallback = (log: number) => {
            this._logMessages += 'Flashing in Progress... ' + log + '%\n';
        };
        
        // read zip file
        const blobReader = new zip.BlobReader(updates);
        const zipReader = new zip.ZipReader(blobReader);
        const zipEntries = await zipReader.getEntries();

        // find manifest file
        const manifestFile = zipEntries.find((zipEntry: {filename: string}) => zipEntry.filename === "manifest.json");
        if(!manifestFile){
            throw Error("manifest.json not found in firmware file!");
        }

        // read manifest file as text
        //@ts-ignore
        const text = await manifestFile.getData(new zip.TextWriter());

        // parse manifest json
        const json = JSON.parse(text);
        const manifest = json.manifest;

        // flash application image
        if(manifest.application){
            await vscode.commands.executeCommand('riot-web-extension.device.cleanUp');
            await vscode.commands.executeCommand('riot-web-extension.eventListener.lock');
            await this.enterDfuMode();
            while (!(this._webPort as SerialPort).connected) {
                //Device was not in DFU mode, need to find new Serial Port
                await this.rediscoverPort();
            }
            console.log('Starting Flash');
            await this.dfuSendImage(this.HEX_TYPE_APPLICATION, zipEntries, manifest.application, progressCallback);
            //Device exits DFU mode, need to find new Serial Port
            await this.rediscoverPort();
            console.log('Flash Complete');
        }
    }

    /**
     * Sends the firmware image to the device in DFU mode.
     * @param programMode
     * @param zipEntries
     * @param firmwareManifest
     * @param progressCallback
     * @returns {Promise<void>}
     */
    async dfuSendImage(programMode: number, zipEntries: zip.Entry[], firmwareManifest: {bin_file: string, dat_file: string}, progressCallback: (log:number) => void) {
        // open port
        await this._webPort.open({
            baudRate: this.FLASH_BAUD,
        });

        // wait SERIAL_PORT_OPEN_WAIT_TIME
        await this.sleepMillis(this.SERIAL_PORT_OPEN_WAIT_TIME * 1000);

        // file sizes
        var softdeviceSize = 0;
        var bootloaderSize = 0;
        var applicationSize = 0;

        // read bin file (firmware)
        const binFile = zipEntries.find((zipEntry) => zipEntry.filename === firmwareManifest.bin_file);
        if (!binFile) {
            throw Error('BinFile could not be read');
        }
        //@ts-ignore
        const firmware = await binFile.getData(new zip.Uint8ArrayWriter());

        // read dat file (init packet)
        const datFile = zipEntries.find((zipEntry) => zipEntry.filename === firmwareManifest.dat_file);
        if (!datFile) {
            throw Error('DatFile could not be read');
        }
        //@ts-ignore
        const init_packet = await datFile.getData(new zip.Uint8ArrayWriter());

        // only support flashing application for now
        if(programMode !== this.HEX_TYPE_APPLICATION){
            throw Error("not implemented");
        }

        // determine application size
        if(programMode === this.HEX_TYPE_APPLICATION){
            applicationSize = firmware.length;
        }

        console.log("Sending DFU start packet");
        await this.sendStartDfu(programMode, softdeviceSize, bootloaderSize, applicationSize);

        console.log("Sending DFU init packet");
        await this.sendInitPacket(init_packet);

        console.log("Sending firmware");
        await this.sendFirmware(firmware, progressCallback);

        await this._webPort.close();

        console.log("Waiting for reconnect");
        await this.sleepMillis(1000);

        console.log('ending dfu send image');

        this.sequenceNumber = 0;
        this.total_size = 0;
    }

    /**
     * Calculates CRC16 on the provided binaryData
     * @param {Uint8Array} binaryData - Array with data to run CRC16 calculation on
     * @param {number} crc - CRC value to start calculation with
     * @return {number} - Calculated CRC value of binaryData
     */
    calcCrc16(binaryData: Uint8Array, crc = 0xffff) {

        for(let b of binaryData){
            crc = (crc >> 8 & 0x00FF) | (crc << 8 & 0xFF00);
            crc ^= b;
            crc ^= (crc & 0x00FF) >> 4;
            crc ^= (crc << 8) << 4;
            crc ^= ((crc & 0x00FF) << 4) << 1;
        }

        return crc & 0xFFFF;

    }

    /**
     * Encode esc characters in a SLIP package.
     * Replace 0xC0 with 0xDBDC and 0xDB with 0xDBDD.
     * @param dataIn
     * @returns {*[]}
     */
    slipEncodeEscChars(dataIn: number[]) {

        let result = [];

        for(let i = 0; i < dataIn.length; i++){
            let char = dataIn[i];
            if(char === 0xC0){
                result.push(0xDB);
                result.push(0xDC);
            } else if(char === 0xDB) {
                result.push(0xDB);
                result.push(0xDD);
            } else {
                result.push(char);
            }
        }

        return result;

    }

    /**
     * Creates an HCI packet from the provided frame data.
     * https://github.com/adafruit/Adafruit_nRF52_nrfutil/blob/master/nordicsemi/dfu/dfu_transport_serial.py#L332
     * @param frame
     * @returns {*[]}
     */
    createHciPacketFromFrame(frame: number[]) {

        // increase sequence number, but roll over at 8
        this.sequenceNumber = (this.sequenceNumber + 1) % 8;

        // create slip header
        const slipHeaderBytes = this.createSlipHeader(
            this.sequenceNumber,
            this.DATA_INTEGRITY_CHECK_PRESENT,
            this.RELIABLE_PACKET,
            this.HCI_PACKET_TYPE,
            frame.length,
        );

        // create packet data
        let data = [
            ...slipHeaderBytes,
            ...frame,
        ];

        // add crc of data
        const crc = this.calcCrc16(new Uint8Array(data), 0xffff);
        data.push(crc & 0xFF);
        data.push((crc & 0xFF00) >> 8);

        // add escape characters
        return [
            0xc0,
            ...this.slipEncodeEscChars(data),
            0xc0,
        ];

    }

    /**
     * Calculate how long we should wait for erasing data.
     * @returns {number}
     */
    getEraseWaitTime() {
        // always wait at least 0.5 seconds
        return Math.max(0.5, ((this.total_size / this.FLASH_PAGE_SIZE) + 1) * this.FLASH_PAGE_ERASE_TIME);
    }

    /**
     * Constructs the image size packet sent in the DFU Start packet.
     * @param softdeviceSize
     * @param bootloaderSize
     * @param appSize
     * @returns {number[]}
     */
    createImageSizePacket(softdeviceSize = 0, bootloaderSize = 0, appSize = 0) {
        return [
            ...this.int32ToBytes(softdeviceSize),
            ...this.int32ToBytes(bootloaderSize),
            ...this.int32ToBytes(appSize),
        ];
    }

    /**
     * Sends the DFU Start packet to the device.
     * @param mode
     * @param softdevice_size
     * @param bootloader_size
     * @param app_size
     * @returns {Promise<void>}
     */
    async sendStartDfu(mode: number, softdevice_size = 0, bootloader_size = 0, app_size = 0){

        // create frame
        const frame = [
            ...this.int32ToBytes(this.DFU_START_PACKET),
            ...this.int32ToBytes(mode),
            ...this.createImageSizePacket(softdevice_size, bootloader_size, app_size),
        ];

        // send hci packet
        await this.sendPacket(this.createHciPacketFromFrame(frame));

        // remember file sizes for calculating erase wait time
        this.total_size = softdevice_size + bootloader_size + app_size;

        // wait for initial erase
        await this.sleepMillis(this.getEraseWaitTime() * 1000);

    }

    /**
     * Sends the DFU Init packet to the device.
     * @param initPacket
     * @returns {Promise<void>}
     */
    async sendInitPacket(initPacket: number[]){

        // create frame
        const frame = [
            ...this.int32ToBytes(this.DFU_INIT_PACKET),
            ...initPacket,
            ...this.int16ToBytes(0x0000), // padding required
        ];

        // send hci packet
        await this.sendPacket(this.createHciPacketFromFrame(frame));

    }

    /**
     * Sends the firmware file to the device in multiple chunks.
     * @param firmware
     * @param progressCallback
     * @returns {Promise<void>}
     */
    async sendFirmware(firmware: number[], progressCallback: (log: number) => void) {

        const packets = [];
        var packetsSent = 0;

        // chunk firmware into separate packets
        for(let i = 0; i < firmware.length; i += this.DFU_PACKET_MAX_SIZE){
            packets.push(this.createHciPacketFromFrame([
                ...this.int32ToBytes(this.DFU_DATA_PACKET),
                ...firmware.slice(i, i + this.DFU_PACKET_MAX_SIZE),
            ]));
        }

        // send initial progress
        if(progressCallback){
            progressCallback(0);
        }

        // send each packet one after the other
        for(var i = 0; i < packets.length; i++){

            // send packet
            await this.sendPacket(packets[i]);

            // wait a bit to allow device to write before sending next packet
            await this.sleepMillis(this.FLASH_PAGE_WRITE_TIME * 1000);

            // update progress
            packetsSent++;
            if(progressCallback){
                const progress = Math.floor((packetsSent / packets.length) * 100);
                progressCallback(progress);
            }

        }

        // finished sending firmware, send DFU Stop Data packet
        await this.sendPacket(this.createHciPacketFromFrame([
            ...this.int32ToBytes(this.DFU_STOP_DATA_PACKET),
        ]));

    }

    /**
     * Creates a SLIP header.
     *
     * For a description of the SLIP header go to:
     * http://developer.nordicsemi.com/nRF51_SDK/doc/7.2.0/s110/html/a00093.html
     *
     * @param {number} seq - Packet sequence number
     * @param {number} dip - Data integrity check
     * @param {number} rp - Reliable packet
     * @param {number} pktType - Payload packet
     * @param {number} pktLen - Packet length
     * @return {Uint8Array} - SLIP header
     */
    createSlipHeader(seq: number, dip: number, rp: number, pktType: number, pktLen: number) {
        let ints = [0, 0, 0, 0];
        ints[0] = seq | (((seq + 1) % 8) << 3) | (dip << 6) | (rp << 7);
        ints[1] = pktType | ((pktLen & 0x000F) << 4);
        ints[2] = (pktLen & 0x0FF0) >> 4;
        ints[3] = (~(ints[0] + ints[1] + ints[2]) + 1) & 0xFF;
        return new Uint8Array(ints);
    }

    /**
     * Converts the provided int32 to 4 bytes.
     * @param num
     * @returns {number[]}
     */
    int32ToBytes(num: number){
        return [
            (num & 0x000000ff),
            (num & 0x0000ff00) >> 8,
            (num & 0x00ff0000) >> 16,
            (num & 0xff000000) >> 24,
        ];
    }

    /**
     * Converts the provided int16 to 2 bytes.
     * @param num
     * @returns {number[]}
     */
    int16ToBytes(num: number){
        return [
            (num & 0x00FF),
            (num & 0xFF00) >> 8,
        ];
    }
}