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

    
    getTreeItem(element: Uri): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const isDir = vscode.workspace.fs.stat(element).then(stat => stat.type === vscode.FileType.Directory);
        const treeItem = new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.Collapsed);
        return treeItem;
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