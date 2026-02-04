//Esp Boards (Serial) using esptool.js
const espBoards = [
    'esp32c3-devkit',
    'esp32c3-wemos-mini',
    'esp32c6-devkit',
    'esp32-ethernet-kit-v1_0',
    'esp32-ethernet-kit-v1_1',
    'esp32-ethernet-kit-v1_2',
    'esp32h2-devkit',
    'esp32-heltec-lora32-v2',
    'esp32-mh-et-live-minikit',
    'esp32-olimex-evb',
    'esp32s2-devkit',
    'esp32s2-lilygo-ttgo-t8',
    'esp32s2-wemos-mini',
    'esp32s3-box',
    'esp32s3-devkit',
    'esp32s3-pros3',
    'esp32s3-usb-otg',
    'esp32s3-wt32-sc01-plus',
    'esp32-ttgo-t-beam',
    'esp32-wemos-d1-r32',
    'esp32-wemos-lolin-d32-pro',
    'esp32-wroom-32',
    'esp32-wrover-kit',
    'esp8266-esp-12x',
    'esp8266-olimex-mod',
    'esp8266-sparkfun-thing',
] as const;

/** @see {isEspBoard} ts-auto-guard:type-guard */
export type espBoardsType = typeof espBoards[number];

//Boards using WebSerial Api, no flasher
const serialBoards = [
    'Standard Serial Board',
    ...espBoards
] as const;

/** @see {isSerialBoard} ts-auto-guard:type-guard */
export type serialBoardsType = typeof serialBoards[number];



//Boards using WebUSB Api, no flasher
const usbBoards = [
    'Standard USB Board',
] as const;

/** @see {isUSBBoard} ts-auto-guard:type-guard */
export type usbBoardsType = typeof usbBoards[number];



export const supportedBoards = [...serialBoards, ...usbBoards].sort();