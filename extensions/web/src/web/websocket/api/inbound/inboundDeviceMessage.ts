//All messages that can be received by a Device/the DeviceManager from the WebsocketManager
import {commandTypes, deviceAddress, messageTypes, shellAddress, terminationTypes} from "../additionalTypes";

type deviceReceiveAddress = [
    shellAddress,
    deviceAddress
]

type flashCommand = [
    commandTypes.FLASH,
    board: string,
    binaries: {[offset:string]: any},
    arguments: string
]

type termCommand = [
    commandTypes.TERM,
    board: string,
    baudrate: number
]

export type command = flashCommand | termCommand

export type inboundDeviceMessage = [
    messageTypes.ACK,
    ...deviceReceiveAddress
] | [
    messageTypes.RST,
    ...deviceReceiveAddress,
    terminationTypes,
    msg: string
] | [
    messageTypes.CMD,
    ...deviceReceiveAddress,
    command
] | [
    messageTypes.IO,
    ...deviceReceiveAddress,
    input: Uint8Array<ArrayBufferLike>
]