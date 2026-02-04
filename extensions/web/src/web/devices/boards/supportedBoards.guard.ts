/*
 * Generated type guards for "supportedBoards.ts".
 * WARNING: Do not manually change this file.
 */
import {espBoardsType, serialBoardsType, usbBoardsType} from "./supportedBoards";

export function isEspBoard(obj: unknown): obj is espBoardsType {
    const typedObj = obj as espBoardsType
    return (
        (typedObj === "esp32c3-devkit" ||
            typedObj === "esp32c3-wemos-mini" ||
            typedObj === "esp32c6-devkit" ||
            typedObj === "esp32-ethernet-kit-v1_0" ||
            typedObj === "esp32-ethernet-kit-v1_1" ||
            typedObj === "esp32-ethernet-kit-v1_2" ||
            typedObj === "esp32h2-devkit" ||
            typedObj === "esp32-heltec-lora32-v2" ||
            typedObj === "esp32-mh-et-live-minikit" ||
            typedObj === "esp32-olimex-evb" ||
            typedObj === "esp32s2-devkit" ||
            typedObj === "esp32s2-lilygo-ttgo-t8" ||
            typedObj === "esp32s2-wemos-mini" ||
            typedObj === "esp32s3-box" ||
            typedObj === "esp32s3-devkit" ||
            typedObj === "esp32s3-pros3" ||
            typedObj === "esp32s3-usb-otg" ||
            typedObj === "esp32s3-wt32-sc01-plus" ||
            typedObj === "esp32-ttgo-t-beam" ||
            typedObj === "esp32-wemos-d1-r32" ||
            typedObj === "esp32-wemos-lolin-d32-pro" ||
            typedObj === "esp32-wroom-32" ||
            typedObj === "esp32-wrover-kit" ||
            typedObj === "esp8266-esp-12x" ||
            typedObj === "esp8266-olimex-mod" ||
            typedObj === "esp8266-sparkfun-thing")
    )
}

export function isSerialBoard(obj: unknown): obj is serialBoardsType {
    const typedObj = obj as serialBoardsType
    return (
        (typedObj === "esp32c3-devkit" ||
            typedObj === "esp32c3-wemos-mini" ||
            typedObj === "esp32c6-devkit" ||
            typedObj === "esp32-ethernet-kit-v1_0" ||
            typedObj === "esp32-ethernet-kit-v1_1" ||
            typedObj === "esp32-ethernet-kit-v1_2" ||
            typedObj === "esp32h2-devkit" ||
            typedObj === "esp32-heltec-lora32-v2" ||
            typedObj === "esp32-mh-et-live-minikit" ||
            typedObj === "esp32-olimex-evb" ||
            typedObj === "esp32s2-devkit" ||
            typedObj === "esp32s2-lilygo-ttgo-t8" ||
            typedObj === "esp32s2-wemos-mini" ||
            typedObj === "esp32s3-box" ||
            typedObj === "esp32s3-devkit" ||
            typedObj === "esp32s3-pros3" ||
            typedObj === "esp32s3-usb-otg" ||
            typedObj === "esp32s3-wt32-sc01-plus" ||
            typedObj === "esp32-ttgo-t-beam" ||
            typedObj === "esp32-wemos-d1-r32" ||
            typedObj === "esp32-wemos-lolin-d32-pro" ||
            typedObj === "esp32-wroom-32" ||
            typedObj === "esp32-wrover-kit" ||
            typedObj === "esp8266-esp-12x" ||
            typedObj === "esp8266-olimex-mod" ||
            typedObj === "esp8266-sparkfun-thing" ||
            typedObj === "Standard Serial Board")
    )
}

export function isUSBBoard(obj: unknown): obj is usbBoardsType {
    const typedObj = obj as usbBoardsType
    return (
        typedObj === "Standard USB Board"
    )
}
