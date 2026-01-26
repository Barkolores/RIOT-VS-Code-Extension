//All messages that can be received by a Device/the DeviceManager from the WebsocketManager
import {deviceAddress, messageTypes, shellAddress, terminationTypes} from "../additionalTypes";

type deviceReceiveAddress = [
    shellAddress,
    deviceAddress
]

export type inboundDeviceMessage = [
    messageTypes.DNR,
    shellAddress,
    deviceName: string
] | [
    messageTypes.SRM_ACK,
    ...deviceReceiveAddress
] | [
    messageTypes.LTM,
    ...deviceReceiveAddress,
    terminationTypes,
    msg: string
] | [
    messageTypes.FLASH,
    ...deviceReceiveAddress,
    board: string,
    binaries: {[offset:string]: any},
    agruments: string
] | [
    messageTypes.TERM,
    ...deviceReceiveAddress,
    board: string,
    baudrate: number
] | [
    messageTypes.INPUT,
    ...deviceReceiveAddress,
    input: string
]