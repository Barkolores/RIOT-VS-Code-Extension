/*
 * Generated type guards for "inboundWSMessage.ts".
 * WARNING: Do not manually change this file.
 */
import {addressTypes, commandTypes, messageTypes, terminationTypes} from "../additionalTypes";
import {inboundWSMessage} from "./inboundWSMessage";

export function isValidInboundMessage(obj: unknown): obj is inboundWSMessage {
    const typedObj = obj as inboundWSMessage
    return (
        (Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.ACK &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.RST &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "string" &&
            (typedObj[3] === terminationTypes.SUCCESS ||
                typedObj[3] === terminationTypes.ERROR) &&
            typeof typedObj[4] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.CMD &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "string" &&
            (Array.isArray(typedObj[3]) &&
                typedObj[3][0] === commandTypes.FLASH &&
                typeof typedObj[3][1] === "string" &&
                (typedObj[3][2] !== null &&
                    typeof typedObj[3][2] === "object" ||
                    typeof typedObj[3][2] === "function") &&
                Object.entries<any>(typedObj[3][2])
                    .every(([key, _value]) => (typeof key === "string")) &&
                typeof typedObj[3][3] === "string" ||
                Array.isArray(typedObj[3]) &&
                typedObj[3][0] === commandTypes.TERM &&
                typeof typedObj[3][1] === "string" &&
                typeof typedObj[3][2] === "number") ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.IO &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "string" ||
            Array.isArray(typedObj) &&
            (typedObj[0] === messageTypes.CONNECT_ACK ||
                typedObj[0] === messageTypes.DISCONNECT))
    )
}
