import * as path from 'path';
import { Uri } from "vscode";
import vscode from "vscode";

export class RiotFileTreeProvider implements vscode.TreeDataProvider<Uri>{
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.Uri | undefined | void> = new vscode.EventEmitter<vscode.Uri | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.Uri | undefined | void> = this._onDidChangeTreeData.event;
    
    private rootUris: vscode.Uri[] = [];

    public addAppFolder(uri: vscode.Uri) {
        if(!this.rootUris.some(r => r.fsPath === uri.fsPath)) {
            this.rootUris.push(uri);
            this.refresh();
        }
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

 

    async getTreeItem(element: Uri): Promise <vscode.TreeItem> {
        try {
            const stat = await vscode.workspace.fs.stat(element);
            const isDir = stat.type === vscode.FileType.Directory;

            const treeItem = new vscode.TreeItem(element, 
                isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );
            treeItem.id = element.fsPath;
            if(!isDir) {
                treeItem.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [element]
                };
                treeItem.contextValue = 'file';
            }else {
                treeItem.contextValue = 'folder';
            }
            return treeItem;
        }catch (err) {           
            return new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.None);
        }
    }

    getParent(element: Uri): vscode.ProviderResult<Uri> {
        const fsPath = element.fsPath;

        if(this.rootUris.some(root => element.fsPath === root.fsPath)){
            return undefined;
        }
        const parentPath = path.dirname(fsPath); 
        return vscode.Uri.file(parentPath);
    }

    async getChildren(element?: vscode.Uri): Promise<vscode.Uri[]> {
        if(!element) {
            return this.rootUris;
        }
        try {
            const entries = await vscode.workspace.fs.readDirectory(element);
            entries.sort((a, b) => {
                if(a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });
            return entries.map(([name, type]) => vscode.Uri.joinPath(element, name));
        } catch (err) {
            console.error(`Error reading directory: `, err);
            return [];
        }
    }

    async resolveTreeItem?(item: vscode.TreeItem, element: Uri, token: vscode.CancellationToken): Promise<vscode.TreeItem> {
        const stat = await vscode.workspace.fs.stat(element);
        const isDir = stat.type === vscode.FileType.Directory;

        item.collapsibleState = isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
   
        if(!isDir) {
            item.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [element]
            };
            item.contextValue = 'file';
        }else {
            item.contextValue = 'folder';
        }
        return item;
    }

}