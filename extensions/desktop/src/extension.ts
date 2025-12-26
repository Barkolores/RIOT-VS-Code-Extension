// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as util from 'util';
import { realpathSync } from 'fs';
import * as path from 'path';
import { BoardRecognizer } from './boards/BoardRecognizer';
import { PortDiscovery } from './boards/PortDiscoverer';
import { DeviceModel, DeviceConfig } from './boards/device';
import { VsCodeRiotFlashTask } from './tasks/VsCodeRiotFlashTask';
import { VsCodeCompileCommandsTask } from './tasks/VsCodeCompileCommandsTask';
import { VsCodeRiotTermTask } from './tasks/VsCodeRiotTermTask';
import { DeviceTreeItemProvider } from './treeView/uiDeviceProvider';
import { DeviceTreeItem } from './treeView/uiDevice';
import { SelectedBoardTreeItem } from './treeView/uiSelBoard';
import { SelectedPortTreeItem } from './treeView/uiSelPort';
import { SelectedFolderTreeItem } from './treeView/uiSelFolder';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const FOLDER_DEVICE_CACHE_KEY = 'riot-launcher.folderDeviceMap';
	const DEVICE_LIST_CACHE_KEY = 'riot-launcher.deviceList';


	const storedMap = context.workspaceState.get<Record<string, DeviceConfig>>(FOLDER_DEVICE_CACHE_KEY, {});


	// refreshWorkspaceFolderLabels();
	// decorationProvider.updateState(activeFolderPath, folderDeviceMap);

	const initialDevicesConfig = context.workspaceState.get<DeviceConfig[]>(DEVICE_LIST_CACHE_KEY, []);
	const initialDevices: DeviceModel[] = initialDevicesConfig.map(d => DeviceModel.fromConfig(d));

	async function readBundledBoards(): Promise<string[]> {
		const filePath = path.join(context.extensionPath, 'resources', 'boards.txt');
		const text : string = await fs.promises.readFile(filePath, 'utf8');
		console.log("read boards " + text);
		return text.split('\n').filter(line => line.length > 0);
	}

	let boards : string[] = await readBundledBoards().catch<string[]>( (_err) => ['adafruit-feather-nrf52840-sense'] );

	const riotDropDownBoard = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left, 101
	);

    
	context.subscriptions.push(riotDropDownBoard);


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "riot-launcher" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const config = vscode.workspace.getConfiguration('riot-launcher');
	var riotBasePath : string = config.get<string>('riotPath') || '';

	const devicesTreeItemProvider = new DeviceTreeItemProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('riotView', devicesTreeItemProvider));

	const addDeviceDisposable = vscode.commands.registerCommand('riot-launcher.addDevice', async (device : DeviceModel) => {
		console.log("button pressed");
		devicesTreeItemProvider.addDevice(new DeviceModel(undefined, undefined, undefined));
	});
	context.subscriptions.push(addDeviceDisposable);

	const setRiotPathDisposable = vscode.commands.registerCommand('riot-launcher.setRiotPath', async () => {
		const result = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select RIOT Base Folder'
		});

		if (result && result.length > 0) {
			riotBasePath = result[0].fsPath;
			await config.update('riotPath', riotBasePath, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`Set RIOT Path to: ${riotBasePath}`);
		}
		loadBoards().then( (loadedBoards : string[]) => boards = loadedBoards).catch( (_err) => {
			vscode.window.showErrorMessage("Error loading boards from RIOT Path, using offline boards as fallback.");
		});
	});

	const execAsync = util.promisify(exec);

	async function loadBoards(): Promise<string[]> {
		try {
			const { stdout } = await execAsync(
				`cd "${riotBasePath}" && make info-boards`
			);

			const boards: string[] = stdout
			.toString()
			.trim()
			.split(/\s+/)       //Escape characters for SPACE
			.filter(Boolean);
			
			vscode.window.showInformationMessage(`Loaded ${boards.length} boards from RIOT Path.`);
			if(boards.length > 0) {
				return boards;
			}else {
				throw new Error('No boards found in RIOT Path.');
			}
		} catch (error) {
			throw new Error('Error loading boards from RIOT Path.');
		}	
	}
	
	const flashDisposable = vscode.commands.registerCommand('riot-launcher.riotFlash', (d : DeviceTreeItem)=> {
		if(!d) { return; }
		const device = d.getDevice();
		const appPath = device.getAppPath();
		if(!appPath || !device) {
			vscode.window.showErrorMessage("Application folder or device not properly selected.");
			return;
		}
		const flashTask = new VsCodeRiotFlashTask(appPath, device).getVscodeTask();
		if(!flashTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
			return;
		}
		vscode.tasks.executeTask(flashTask);
	});

	context.subscriptions.push(flashDisposable);

	const termDisposable = vscode.commands.registerCommand('riot-launcher.riotTerm', (d : DeviceTreeItem) => {
		if(!d) { return; }
		const device = d.getDevice();
		const appPath = device.getAppPath();
		if(!appPath || !device) {
			vscode.window.showErrorMessage("Application folder or device not properly selected.");
			return;
		}
		const termTask = new VsCodeRiotTermTask(appPath, device).getVscodeTask();
		if(!termTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
			return;
		}
		vscode.tasks.executeTask(termTask);
	});

	context.subscriptions.push(termDisposable);
	
	const debugDisposable = vscode.commands.registerCommand('riot-launcher-riotDebug', (d: DeviceTreeItem) => {

	});
	//TODO
	const searchPortsDisposable = vscode.commands.registerCommand('riot-launcher.detectPorts', async () => {
		// const boardRegonizer = new BoardRecognizer (context, boards);
		// const portDiscoverer = new PortDiscovery(boardRegonizer);
		// const foundDevices = await portDiscoverer.discoverPorts();
		// deviceProvider.refresh(foundDevices);
		// saveDeviceListState();
	});

	context.subscriptions.push(searchPortsDisposable);

	const changeBoardDisposable = vscode.commands.registerCommand('riot-launcher.changeBoardDevice', async (treeItem : SelectedBoardTreeItem) => {
	 	if(!treeItem) {
			vscode.window.showErrorMessage("Please execute this command via RIOT panel.");
		}
		const pick : string | undefined = await vscode.window.showQuickPick(boards, {
	 		title: 'Device configuration',
	 		placeHolder: 'Select new board for device'
		});
		
		if(pick) {
	 		treeItem.changeBoard(pick);
			vscode.window.showInformationMessage(`Changed board of device to: ${pick}`);
			devicesTreeItemProvider.refresh();
			const device = treeItem.getDevice();
			const appPath = device.getAppPath();
			if(appPath) {
				const compileTask = new VsCodeCompileCommandsTask(appPath, treeItem.getDevice()).getVscodeTask();
				if(!compileTask) {
					vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
					return;
				}
				vscode.tasks.executeTask(compileTask);
				configureCompiledCommands(riotBasePath, appPath);
			}

	 	}
	});

	context.subscriptions.push(changeBoardDisposable);

	const changeApplicationFolderDisposable = vscode.commands.registerCommand('riot-launcher.changeFolderDevice', async (treeItem : SelectedFolderTreeItem) => {
		const result = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Application Folder'
		});

		if (result && result.length > 0) {
			const appFolderPath = result[0].fsPath;
			vscode.window.showInformationMessage(`Selected Example Folder: ${appFolderPath}`);
			try {
				const { stdout } = await execAsync(
					`cd ${appFolderPath} && make info-debug-variable-RIOTBASE`
				);
				riotBasePath = stdout.toString().trim();
				loadBoards().then((loadedBoards : string[]) => boards = loadedBoards);
				/* Add folder to workspace*/ 
				const isAlreadyOpen = vscode.workspace.workspaceFolders?.some( 
					folder => folder.uri.fsPath === appFolderPath
				);
				if(!isAlreadyOpen) {
					vscode.workspace.updateWorkspaceFolders(
						vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
						0,
						{ uri: vscode.Uri.file(appFolderPath) }
					);
				}
				treeItem.setAppPath(appFolderPath);
				/* Compile commands and configuring IntelliSense */
				const device = treeItem.getDevice();
				vscode.window.showInformationMessage(`DEBUG: ${device.getBoardName()}`);
				if(device.getBoardName()) {
					const compileTask = new VsCodeCompileCommandsTask(appFolderPath, device).getVscodeTask();
					if(!compileTask) {
						vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
						return;
					}
					vscode.tasks.executeTask(compileTask);
					configureCompiledCommands(riotBasePath, appFolderPath);
				}
				devicesTreeItemProvider.refresh();
				// Include logic of inserting RIOT base folder here in case a nested RIOT example is selected
			}catch (error) {
				vscode.window.showErrorMessage(
					'Error determining RIOT Base Path from Makefile'
				);
			}
		}
	});

	context.subscriptions.push(changeApplicationFolderDisposable);

	const changePortDisposable = vscode.commands.registerCommand('riot-launcher.changePortDevice', async (treeItem : SelectedPortTreeItem) => {
		if(!treeItem) {
			vscode.window.showErrorMessage("Please execute this command via RIOT panel.");
			return;
		}

		const PortDiscoverer = new PortDiscovery();
		const foundPorts = await PortDiscoverer.discoverPorts();
		const portOptions = [
			{ label: 'None', description: 'No port assigned' },
    	];
		portOptions.push(...foundPorts.map(p => ({ label: p, description: 'Found port' })));
		portOptions.push({ label: 'Custom...', description: 'Type manually' });

		const selected = await vscode.window.showQuickPick(portOptions, {
			title: 'Device configuration',
			placeHolder: 'Select a port or choose "Custom..." to enter your individual port'
		});
		if(selected) {
			let  finalPort : string | undefined = selected.label;
			if(selected.label === 'Custom...') {
				finalPort = await vscode.window.showInputBox({
					title: 'Device configuration',
					prompt: 'Enter new port path',
					value: treeItem.getPortPath()
				});
			}
			if(finalPort) {
				treeItem.changePortPath(finalPort);
				vscode.window.showInformationMessage(`Changed port of device to: ${finalPort}`);
				devicesTreeItemProvider.refresh();
			}

		}
	});
	
	context.subscriptions.push(changePortDisposable);
	//TODO
	async function saveFolderMapState() {
	// 	const toSave: Record<string, DeviceConfig> = {};
	
	// 	for (const entry of folderDeviceMap) {
	// 		toSave[entry[0]] = entry[1].toConfig();
	// 	}

	// 	await context.workspaceState.update(FOLDER_DEVICE_CACHE_KEY, toSave);
	// }

	// async function receiveRiotBasePath() {
	// 	var type : string 	= "riotTaskProvider";
	// 	const cDir : string = "cd " + activeFolderPath;
	// 	const cDetermineRiot : string = "make info-debug-variable-RIOTBASE";

	// 	var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cDetermineRiot);
	// 	var task : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
    //                 "Set Path", "riot-launcher", execution);
	// 	return task;
	}

	function isSubDirecttory(parent: string, dir : string) : boolean {
		const parentReal = realpathSync(parent);
		const dirReal = realpathSync(dir);
		const relative = path.relative(parentReal, dirReal);
		return (
			relative !== '' &&
			!relative.startsWith('..') &&
			!path.isAbsolute(relative)
		);
	}

	async function configureCompiledCommands(riotBasePath : string, appFolderPath : string) {
		const config = vscode.workspace.getConfiguration('C_Cpp', vscode.Uri.file(appFolderPath));

		const compileCommandsPath = path.join(riotBasePath, 'compile_commands.json');

		const currentSetting = config.get<string>('default.compileCommands');

		if(currentSetting !== compileCommandsPath) {
			await config.update(
				'default.compileCommands',
				compileCommandsPath,
				vscode.ConfigurationTarget.WorkspaceFolder
			);
			vscode.window.showInformationMessage("Compiled commands adapted");
		}
		
	}
}


// This method is called when your extension is deactivated
export function deactivate() {}

/* Items shown in TreeView */ 
class CmdItem extends vscode.TreeItem {
	constructor(label : string, commandId: any, icon: any) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.command = { command : commandId, title: label };
		if(typeof icon === 'string') {
			this.iconPath = new vscode.ThemeIcon(icon);
		} else if(icon) {
			this.iconPath = icon;
		}
	} 
}

		

