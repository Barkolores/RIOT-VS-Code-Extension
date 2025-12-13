export interface BoardStruct {
    vendorId: string;
    productId: string;
    boardId: string;
    boardName: string;
}

export const boardsDB: BoardStruct[] = [
    { vendorId: '10c4', productId: 'ea60', boardId: 'esp32-wroom-32', boardName: 'ESP32 Dev Module (CP210x)' },
    { vendorId: '303a', productId: '1001', boardId: 'esp32-c3-devkit', boardName: 'ESP32-C3' },

    { vendorId: '1366', productId: '1015', boardId: 'nrf52dk', boardName: 'nRF52 DK' },
    { vendorId: '1366', productId: '1051', boardId: 'nrf52840dk', boardName: 'nRF52840 DK' },

    { vendorId: '0d28', productId: '0204', boardId: 'microbit', boardName: 'BBC micro:bit' },

    { vendorId: '2341', productId: '0043', boardId: 'arduino-uno', boardName: 'Arduino Uno' },
    { vendorId: '2341', productId: '0042', boardId: 'arduino-mega2560', boardName: 'Arduino Mega 2560' },
    
    { vendorId: '0483', productId: '374b', boardId: 'nucleo-f401re', boardName: 'STM32 Nucleo-64 (Default)' },

    { vendorId: '1209', productId: '7d00', boardId: 'adafruit-feather-nrf52840-sense', boardName: 'adafruit-feather-nrf52840-sense'}
];