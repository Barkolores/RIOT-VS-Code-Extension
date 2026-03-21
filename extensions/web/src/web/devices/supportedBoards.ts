//Esp Boards (Serial) using esptool.js by espressif
export const espBoards = [
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
    'seeedstudio-xiao-esp32c3',
    'seeedstudio-xiao-esp32s3'
];

//nrf52840 Boards (Serial) using RNode flasher (adafruit-nrfutil javascript implementation by Liam Cottle)
export const nrfBoards = [
    'adafruit-clue',
    'adafruit-feather-nrf52840-express',
    'adafruit-feather-nrf52840-sense',
    'adafruit-itsybitsy-nrf52',
    'pro-micro-nrf52840',
    'seeedstudio-xiao-nrf52840-sense',
    'seeedstudio-xiao-nrf52840'
];

//Boards using WebSerial Api, append standard without flasher
export const serialBoards = [
    'Standard Serial Board (Term only)',
    ...espBoards,
    ...nrfBoards
];



//Boards using WebUSB Api, no flasher
// export const usbBoards = [
//     'Standard USB Board',
// ];



export const supportedBoards = [...serialBoards/*, ...usbBoards*/].sort();