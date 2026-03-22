//All messages that can be send by a Device to the WebsocketManager
import {clientAddress, deviceAddress, logTypes, messageTypes, shellAddress, terminationTypes} from "../additionalTypes";

type deviceSendAddress = [
    deviceAddress,
    shellAddress
];

export type commandRequest = [
    'flash' | 'term',
    board: string,
    projectPath: string
]

export type outboundDeviceMessage = [
    messageTypes.RST,
    ...deviceSendAddress,
    terminationTypes,
    msg: string
] | [
    //RST response when device name not found
    messageTypes.RST,
    clientAddress,
    shellAddress,
    terminationTypes,
    msg: string
] | [
    messageTypes.LOG,
    ...deviceSendAddress,
    logTypes,
    msg: string
] | [
    messageTypes.IO,
    ...deviceSendAddress,
    input: Uint8Array<ArrayBufferLike>
] | [
    messageTypes.REQ,
    ...deviceSendAddress,
    newInstance: boolean,
    commandRequest,
]
