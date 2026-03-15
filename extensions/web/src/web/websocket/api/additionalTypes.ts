export enum messageTypes {
    CONNECT = 'connect',
    CONNECT_ACK = 'connect ACK',
    DISCONNECT = 'disconnect',
    REQ = 'REQ',
    ACK = 'ACK',
    RST = 'RST',
    CMD = 'CMD',
    LOG = 'log',
    INPUT = 'input'
}

export enum commandTypes {
    FLASH = 'flash',
    TERM = 'term'
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
export type deviceAddress = [addressTypes.DEVICE, string];
export type shellAddress = [addressTypes.SHELL, number];