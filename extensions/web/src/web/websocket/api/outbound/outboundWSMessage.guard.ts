/*
 * Generated type guards for "outboundWSMessage.ts".
 * WARNING: Do not manually change this file.
 */
import { messageTypes, addressTypes, terminationTypes, logTypes } from "../additionalTypes";
import { outboundWSMessage } from "./outboundWSMessage";

export function isValidOutboundMessage(obj: unknown): obj is outboundWSMessage {
    const typedObj = obj as outboundWSMessage
    return (
        (Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.RST &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.DEVICE &&
            typeof typedObj[1][1] === "string" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.SHELL &&
            typeof typedObj[2][1] === "number" &&
            (typedObj[3] === terminationTypes.SUCCESS ||
                typedObj[3] === terminationTypes.ERROR) &&
            typeof typedObj[4] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.RST &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.CLIENT &&
            typedObj[1][1] === 0 &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.SHELL &&
            typeof typedObj[2][1] === "number" &&
            (typedObj[3] === terminationTypes.SUCCESS ||
                typedObj[3] === terminationTypes.ERROR) &&
            typeof typedObj[4] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.LOG &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.DEVICE &&
            typeof typedObj[1][1] === "string" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.SHELL &&
            typeof typedObj[2][1] === "number" &&
            (typedObj[3] === logTypes.LOG ||
                typedObj[3] === logTypes.ERROR) &&
            typeof typedObj[4] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.REQ &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.DEVICE &&
            typeof typedObj[1][1] === "string" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.SHELL &&
            typeof typedObj[2][1] === "number" &&
            typeof typedObj[3] === "boolean" &&
            Array.isArray(typedObj[4]) &&
            (typedObj[4][0] === "flash" ||
                typedObj[4][0] === "term") &&
            typeof typedObj[4][1] === "string" &&
            typeof typedObj[4][2] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.CONNECT &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.CLIENT &&
            typedObj[1][1] === 0 ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.DISCONNECT)
    )
}
