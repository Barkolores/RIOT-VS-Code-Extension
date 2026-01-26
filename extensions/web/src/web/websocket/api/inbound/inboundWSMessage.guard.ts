/*
 * Generated type guards for "inboundWSMessage.ts".
 * WARNING: Do not manually change this file.
 */
import { messageTypes, addressTypes, terminationTypes } from "../additionalTypes";
import { inboundWSMessage } from "./inboundWSMessage";

export function isValidInboundMessage(obj: unknown): obj is inboundWSMessage {
    const typedObj = obj as inboundWSMessage;
    return (
        (Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.DNR &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            typeof typedObj[2] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.SRM_ACK &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "number" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.LTM &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "number" &&
            (typedObj[3] === terminationTypes.SUCCESS ||
                typedObj[3] === terminationTypes.ERROR) &&
            typeof typedObj[4] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.FLASH &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "number" &&
            typeof typedObj[3] === "string" &&
            (typedObj[4] !== null &&
                typeof typedObj[4] === "object" ||
                typeof typedObj[4] === "function") &&
            Object.entries<any>(typedObj[4])
                .every(([key, _value]) => (typeof key === "string")) &&
            typeof typedObj[5] === "string" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.TERM &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "number" &&
            typeof typedObj[3] === "string" &&
            typeof typedObj[4] === "number" ||
            Array.isArray(typedObj) &&
            typedObj[0] === messageTypes.INPUT &&
            Array.isArray(typedObj[1]) &&
            typedObj[1][0] === addressTypes.SHELL &&
            typeof typedObj[1][1] === "number" &&
            Array.isArray(typedObj[2]) &&
            typedObj[2][0] === addressTypes.DEVICE &&
            typeof typedObj[2][1] === "number" &&
            typeof typedObj[3] === "string" ||
            Array.isArray(typedObj) &&
            (typedObj[0] === messageTypes.CONNECT_ACK ||
                typedObj[0] === messageTypes.DISCONNECT))
    );
}
