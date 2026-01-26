export enum messageTypes {
    CONNECT = 'connect',
    CONNECT_ACK = 'connect ACK',
    DISCONNECT = 'disconnect',
    DNR = 'DNR',
    DNR_ACK = 'DNR ACK',
    SRM = 'SRM',
    SRM_ACK = 'SRM ACK',
    LTM = 'LTM',
    FLASH_REQUEST = 'flash request',
    FLASH = 'flash',
    TERM_REQUEST = 'term request',
    TERM = 'term',
    LOG = 'log',
    INPUT = 'input'
}

export enum logTypes {
    LOG = 'log',
    ERROR = 'error'
}

export enum terminationTypes {
    SUCCESS = 'success',
    ERROR = 'error'
}

export enum addressTypes {
    CLIENT = 'client',
    DEVICE = 'device',
    SHELL = 'shell'
}

export type clientAddress = [addressTypes.CLIENT, 0];
export type deviceAddress = [addressTypes.DEVICE, number];
export type shellAddress = [addressTypes.SHELL, number];