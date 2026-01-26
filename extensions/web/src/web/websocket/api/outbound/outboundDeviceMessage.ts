//All messages that can be send by a Device to the WebsocketManager
import {clientAddress, deviceAddress, logTypes, messageTypes, shellAddress, terminationTypes} from "../additionalTypes";

type deviceSendAddress = [
    deviceAddress,
    shellAddress
];

export type outboundDeviceMessage = [
    messageTypes.DNR_ACK | messageTypes.SRM,
    ...deviceSendAddress
] | [
    messageTypes.LTM,
    ...deviceSendAddress,
    terminationTypes,
    msg: string
] | [
    //LTM response for DNR fail
    messageTypes.LTM,
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
    messageTypes.FLASH_REQUEST | messageTypes.TERM_REQUEST,
    ...deviceSendAddress,
    board: string
]
