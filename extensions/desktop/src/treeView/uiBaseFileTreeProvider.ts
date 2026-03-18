import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class RiotBaseFileTreeProvider implements vscode.TreeDataProvider<vscode.Uri>{
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.Uri | undefined | void> = new vscode.EventEmitter<vscode.Uri | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.Uri | undefined | void> = this._onDidChangeTreeData.event;
    
    private  currentBasePath?: vscode.Uri;

    refresh(newBasePath?: vscode.Uri): void {
        this.currentBasePath = newBasePath;
        this._onDidChangeTreeData.fire();
    } 

    getTreeItem(element: vscode.Uri): vscode.TreeItem {
        const stat = fs.statSync(element.fsPath);
        const isDir = stat.isDirectory();

        const treeItem = new vscode.TreeItem(element, 
            isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        );
        if(!isDir) {
            treeItem.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [element]
            };
        }
        return treeItem;
    }

    async getChildren(element?: vscode.Uri): Promise<vscode.Uri[]> {
        if(!this.currentBasePath) {
            return [];
        }

        const targetPath = element ? element.fsPath : this.currentBasePath.fsPath;
        
        if(!fs.existsSync(targetPath)) { return []; }
        const stat = fs.statSync(targetPath);
        if(!stat.isDirectory()) { return [];}
        
        const files = await fs.promises.readdir(targetPath);
        
        const uris = files.map(f => vscode.Uri.file(path.join(targetPath, f)));

        uris.sort((a, b) => {
            const isDirA = fs.statSync(a.fsPath).isDirectory();
            const isDirB = fs.statSync(b.fsPath).isDirectory();
            if(isDirA && !isDirB) { return -1; }
            if(!isDirA && isDirB) { return 1; }
            return path.basename(a.fsPath).localeCompare(path.basename(b.fsPath));
        });

        return uris;
    }
}