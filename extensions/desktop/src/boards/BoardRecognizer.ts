import { SerialPort } from "serialport";
import vscode from "vscode";
import { DeviceModel } from '../../../../shared/ui/deviceModel';
import { BoardDatabaseEntry } from "./knownBoards";
import path from "path";
import fs from "fs";

export interface DetectionResult {
    boardId: string; 
    boardName: string;
}

export class BoardRecognizer {
    private boards: BoardDatabaseEntry[] = [];
    private dbPath : string;

    constructor(
        protected context: vscode.ExtensionContext,
        protected knownBoardIds?: string[]
    ) {
        this.dbPath = path.join(context.globalStorageUri.fsPath, 'knownBoards.json');
        this.initializeDatabase();
    }

    public recognizeBoard(vendorId?: string, productId?: string) : DetectionResult | undefined {
        const cleanVendorId = vendorId ? vendorId.toLowerCase() : '';
        const cleanProductId = productId ? productId.toLowerCase() : '';

        const match = this.boards.find(board => { 
            return board.vendorId === cleanVendorId && 
                    board.productId === cleanProductId;
        });
        if(match) {
            console.log(`Board recognized: ${match.boardName} (${match.boardId})`);
            return {
                boardId: match.boardId,
                boardName: match.boardName,
            };
        }
        return undefined;
    }

    private initializeDatabase() {
        if(!fs.existsSync(this.context.globalStorageUri.fsPath)) {
            fs.mkdirSync(this.context.globalStorageUri.fsPath, { recursive: true });
        }
        if(fs.existsSync(this.dbPath)) {
            const data = fs.readFileSync(this.dbPath, 'utf-8');
            this.boards = JSON.parse(data) as BoardDatabaseEntry[];
        }else {
            this.saveDatabase();
        }
    }

    private saveDatabase() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.boards, null, 4), 'utf8');
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to save board database.`);
        }
    }

    public addBoard(entry: BoardDatabaseEntry) {
        const existingIndex = this.boards.findIndex(b =>
            b.vendorId === entry.vendorId && b.productId === entry.productId
        );
        if (existingIndex === -1) {
            this.boards.push(entry);
        } else {
            this.boards[existingIndex] = entry;
        }
        this.saveDatabase();
    }

    public removeBoard(vendorId: string, productId: string) {
        this.boards = this.boards.filter(b => b.vendorId !== vendorId || b.productId !== productId);
        this.saveDatabase();
    }
}