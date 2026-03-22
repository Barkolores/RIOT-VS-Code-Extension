import {outboundDeviceMessage} from "./outboundDeviceMessage";
import {clientAddress, messageTypes} from "../additionalTypes";

//All messages that can be send by the WebsocketManager to the WebsocketServer
/** @see {isValidOutboundMessage} ts-auto-guard:type-guard */
export type outboundWSMessage = outboundDeviceMessage | [
    messageTypes.CONNECT,
    clientAddress
] | [
    messageTypes.DISCONNECT
]