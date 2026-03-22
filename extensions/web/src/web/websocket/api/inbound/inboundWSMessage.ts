import {inboundDeviceMessage} from "./inboundDeviceMessage";
import {messageTypes} from "../additionalTypes";

//All messages that can be received by the WebsocketManager from the WebsocketServer
/** @see {isValidInboundMessage} ts-auto-guard:type-guard */
export type inboundWSMessage = inboundDeviceMessage | [
    messageTypes.CONNECT_ACK | messageTypes.DISCONNECT
]