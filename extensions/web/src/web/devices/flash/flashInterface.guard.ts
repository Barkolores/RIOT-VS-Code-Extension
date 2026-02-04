/*
 * Generated type guards for "flashInterface.ts".
 * WARNING: Do not manually change this file.
 */
import {FlashInterface} from "./flashInterface";

export function implementsFlashInterface(obj: unknown): obj is FlashInterface {
    const typedObj = obj as FlashInterface
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typeof typedObj["flash"] === "function"
    )
}
