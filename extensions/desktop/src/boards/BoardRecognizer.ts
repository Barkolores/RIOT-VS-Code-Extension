import { SerialPort } from "serialport";
import vscode from "vscode";
import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { boardsDB } from "./knownBoards";

export interface DetectionResult {
    boardId: string; 
    friendlyName: string;
}

export class BoardRecognizer {

    constructor(
        protected context: vscode.ExtensionContext,
        protected knownBoardIds?: string[]
    ) {}

    public recognizeBoard(vendorId?: string, productId?: string, serialNumber?: string) : DetectionResult | undefined {
        const cleanVendorId = vendorId ? vendorId.toLowerCase() : '';
        const cleanProductId = productId ? productId.toLowerCase() : '';

        const match = boardsDB.find(board => { 
            return board.vendorId === cleanVendorId && 
                    board.productId === cleanProductId;
        });
        if(match) {
            console.log(`Board recognized: ${match.boardName} (${match.boardId})`);
            return {
                boardId: match.boardId,
                friendlyName: match.boardName,
            };
        }
        return undefined;
    }

}