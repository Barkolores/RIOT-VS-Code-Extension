import * as path from 'path';
import { Uri } from "vscode";
import * as vscode from "vscode";
import { exec } from 'child_process';
import * as util from 'util';

const execAsync = util.promisify(exec);

export interface VirtualRiotNode {
    type: 'modulesRoot' | 'packagesRoot' | 'moduleItem' | 'packageItem';
    label: string;
    appUri?: vscode.Uri; 
}

export type RiotTreeElement = vscode.Uri | VirtualRiotNode;

export class RiotFileTreeProvider implements vscode.TreeDataProvider<RiotTreeElement> {
    private _onDidChangeTreeData: vscode.EventEmitter<RiotTreeElement | undefined | void> = new vscode.EventEmitter<RiotTreeElement | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<RiotTreeElement | undefined | void> = this._onDidChangeTreeData.event;
    

    private rootUris: vscode.Uri[] = [];
    private activeAppUri?: vscode.Uri; 
    private fileWatcher?: vscode.FileSystemWatcher;
    private extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.fileWatcher.onDidChange(uri => this.refresh());
        this.fileWatcher.onDidCreate(uri => this.refresh());
        this.fileWatcher.onDidDelete(uri => this.refresh());
    }

    public addAppFolder(uri: vscode.Uri) {
        if(!this.rootUris.some(r => r.fsPath === uri.fsPath)) {
            this.rootUris.push(uri);
            this.refresh();
        }
    }

    public setActiveAppUri(uri: vscode.Uri | undefined) {
        this.activeAppUri = uri;
        this.refresh();
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async getTreeItem(element: RiotTreeElement): Promise<vscode.TreeItem> {
        if (!(element instanceof vscode.Uri)) {
            const isRoot = element.type === 'modulesRoot' || element.type === 'packagesRoot';
            const treeItem = new vscode.TreeItem(
                element.label,
                isRoot ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );
            if (isRoot) {
                // treeItem.iconPath = new vscode.ThemeIcon(element.type === 'modulesRoot' ? 'symbol-namespace' : 'package');
            } else {
                treeItem.iconPath = new vscode.ThemeIcon('symbol-field');
            }
            
            treeItem.contextValue = element.type;
            return treeItem;
        }

        try {
            const stat = await vscode.workspace.fs.stat(element as vscode.Uri);
            const isDir = stat.type === vscode.FileType.Directory;

            const treeItem = new vscode.TreeItem(element, 
                isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );
            treeItem.id = (element as vscode.Uri).fsPath;
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
            if(this.activeAppUri && element.toString() === this.activeAppUri.toString()) {
                treeItem.iconPath = {
                    light: vscode.Uri.joinPath(this.extensionUri, 'resources', '../../../shared/assets/icons/riot-logo-R.svg'),
                    dark: vscode.Uri.joinPath(this.extensionUri, 'resources', '../../../shared/assets/icons/riot-logo-R.svg')
                };
                treeItem.tooltip = `${(element as vscode.Uri).fsPath} (Active Application Folder)`;
            }
            return treeItem;
        } catch (err) {           
            return new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.None);
        }
    }

    getParent(element: RiotTreeElement): vscode.ProviderResult<RiotTreeElement> {
        if (!(element instanceof vscode.Uri)) {
            return undefined;
        }

        const fsPath = element.fsPath;
        if(this.rootUris.some(root => element.fsPath === root.fsPath)){
            return undefined;
        }
        const parentPath = path.dirname(fsPath); 
        return vscode.Uri.file(parentPath);
    }

    async getChildren(element?: RiotTreeElement): Promise<RiotTreeElement[]> {
        if(!element) {
            return this.rootUris;
        }

        if (!(element instanceof vscode.Uri)) {
            if (element.type === 'modulesRoot' && element.appUri) {
                try {
                    const { stdout } = await execAsync(`make info-modules`, { cwd: element.appUri.fsPath });
                    const modules = stdout.toString().trim().split(/\s+/).filter(Boolean);
                    return modules.map(m => ({ type: 'moduleItem', label: m }));
                } catch (e) {
                    return [{ type: 'moduleItem', label: 'Fehler beim Laden der Module' }];
                }
            }
            if (element.type === 'packagesRoot' && element.appUri) {
                try {
                    const { stdout } = await execAsync(`make info-packages`, { cwd: element.appUri.fsPath });
                    const packages = stdout.toString().trim().split(/\s+/).filter(Boolean);
                    if (packages.length === 0){
                        return [{ type: 'packageItem', label: '(No packages)' }];
                    } 
                    return packages.map(p => ({ type: 'packageItem', label: p }));
                } catch (e) {
                    return [{ type: 'packageItem', label: 'Error loading packages' }];
                }
            }
            return []; 
        }

        try {
            const entries = await vscode.workspace.fs.readDirectory(element);
            entries.sort((a, b) => {
                if(a[1] === b[1]) {
                    return a[0].localeCompare(b[0]);
                }
                return a[1] === vscode.FileType.Directory ? -1 : 1;
            });
            
            const children: RiotTreeElement[] = entries.map(([name, type]) => vscode.Uri.joinPath(element, name));

            if (this.activeAppUri && element.toString() === this.activeAppUri.toString()) {
                children.unshift(
                    { type: 'packagesRoot', label: 'Packages', appUri: element },
                    { type: 'modulesRoot', label: 'Modules', appUri: element }
                );
            }

            return children;
        } catch (err) {
            console.error(`Error reading directory: `, err);
            return [];
        }
    }

    public removeAppFolder(uri: vscode.Uri) {
        this.rootUris = this.rootUris.filter(r => r.fsPath !== uri.fsPath);
        if(this.activeAppUri && this.activeAppUri.fsPath === uri.fsPath) {
            this.activeAppUri = undefined;
        }
        this.refresh();
    }

    public dispose() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        this._onDidChangeTreeData.dispose();
    }
}