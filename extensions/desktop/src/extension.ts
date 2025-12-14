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
import { DeviceProvider } from './DeviceProvider';
import { Device, DeviceConfig } from './device';
import { VsCodeRiotFlashTask } from './tasks/VsCodeRiotFlashTask';
import { VsCodeCompileCommandsTask } from './tasks/VsCodeCompileCommandsTask';
import { VsCodeRiotTermTask } from './tasks/VsCodeRiotTermTask';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const FOLDER_DEVICE_CACHE_KEY = 'riot-launcher.folderDeviceMap';
	const ACTIVE_FOLDER_KEY = 'riot-launcher.activeFolder';
	const DEVICE_LIST_CACHE_KEY = 'riot-launcher.deviceList';


	const storedMap = context.workspaceState.get<Record<string, DeviceConfig>>(FOLDER_DEVICE_CACHE_KEY, {});
	let folderDeviceMap = new Map<string, Device>();
	
	for(const entry of Object.entries(storedMap)) {
		folderDeviceMap.set(entry[0], Device.fromConfig(entry[1]));
	}

	let activeFolderPath: string | undefined = context.workspaceState.get<string>(ACTIVE_FOLDER_KEY);

	let selectedDevice: Device | undefined;

	const decorationProvider = new RiotFileDecorationProvider();

	refreshWorkspaceFolderLabels();
	decorationProvider.updateState(activeFolderPath, folderDeviceMap);

	const initialDevicesConfig = context.workspaceState.get<DeviceConfig[]>(DEVICE_LIST_CACHE_KEY, []);
	const initialDevices: Device[] = initialDevicesConfig.map(d => Device.fromConfig(d));

	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decorationProvider)
	);


	async function readBundledBoards(): Promise<string[]> {
		const text : string = await fs.promises.readFile('./Uni/IOT/riot-launcher/resources/boards.txt', 'utf8');
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

  	const provider = new CmdProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('riotView', provider));

	const deviceProvider : DeviceProvider = new DeviceProvider(initialDevices);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('deviceView', deviceProvider));

	const addDeviceDisposable = vscode.commands.registerCommand('riot-launcher.addDevice', async (device : Device) => {
		deviceProvider.addDevice(new Device());
		saveDeviceListState();
	});

	const setBoardDeviceDisposable = vscode.commands.registerCommand('riot-launcher.changeBoardDevice', async (device: Device) => {
		if(!device) {
			vscode.window.showErrorMessage('No device selected.');
			return;
		}
		const pick : string | undefined = await vscode.window.showQuickPick(boards, {
			title: 'Device configuration',
			placeHolder: 'Select new board for device'
		});
		if(pick) {
			device.setBoard(pick);
			vscode.window.showInformationMessage(`Changed board of device to: ${pick}`);
			deviceProvider.refresh();
			saveDeviceListState();
		}
	});

	const setPortDeviceDisposable = vscode.commands.registerCommand('riot-launcher.changePortDevice', async (device: Device) => {
		if(!device) {
			vscode.window.showErrorMessage('No device selected.');
			return;
			}
			const newPort : string | undefined = await vscode.window.showInputBox({
			title: 'Device configuration',
			prompt: 'Enter new port path',
			value: device.portPath
		});	
		if(newPort) {
			device.setPortPath(newPort);
			vscode.window.showInformationMessage(`Changed port of device to: ${newPort}`);
			deviceProvider.refresh();
			saveDeviceListState();	
		}
	});
	
	const removeDeviceDisposable = vscode.commands.registerCommand('riot-launcher.removeDevice', async (device: Device) => {
		if(!device) {
			vscode.window.showErrorMessage('No device selected.');
			return;
		}
		deviceProvider.removeDevice(device);
		vscode.window.showInformationMessage(`Removed device at port: ${device.portPath}`);
		saveDeviceListState();
	});

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


	const selectExampleFolderDisposable = vscode.commands.registerCommand('riot-launcher.selectExampleFolder', async () => {
		if (!riotBasePath) {
			vscode.window.showErrorMessage('RIOT Path is not set. Please set it first.');
			return;
		}

		const result = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Example Folder'
		});

		if (result && result.length > 0) {
			activeFolderPath = result[0].fsPath;
			context.workspaceState.update(ACTIVE_FOLDER_KEY, activeFolderPath);
			vscode.window.showInformationMessage(`Selected Example Folder: ${activeFolderPath}`);
			try {
				const { stdout } = await execAsync(
					'cd ' + activeFolderPath + ' && make info-debug-variable-RIOTBASE'
				);
				riotBasePath = stdout.toString().trim();
				vscode.window.showInformationMessage(`Determined RIOT Base Path: ${riotBasePath}`);
				loadBoards().then( (loadedBoards : string[]) => boards = loadedBoards);

				if(selectedDevice) {
					folderDeviceMap.set(activeFolderPath, selectedDevice);
					await saveFolderMapState();
					vscode.window.showInformationMessage(`Associated Board "${selectedDevice}" with Folder "${activeFolderPath}".`);
					const compileTask = new VsCodeCompileCommandsTask(activeFolderPath, selectedDevice).getVscodeTask();
					if(!compileTask) {
						vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
						return;
					}
					vscode.tasks.executeTask(compileTask);
					configureCompiledCommands();
				}
				const currentFolders = vscode.workspace.workspaceFolders || [];	
				/* This would ensure that examples opened within the RIOT folder would 
				open the whole repository instead of just the application folder */ 				
				// vscode.workspace.updateWorkspaceFolders(
				// 	currentFolders.length,
				// 	0,
				// 	{ 
				// 		// TODO: Discuss whether opening the RIOT Base Path is desired
				// 		// uri: isSubDirecttory(riotBasePath, activeFolderPath) ? 
				// 		// vscode.Uri.file(riotBasePath) : vscode.Uri.file(activeFolderPath) 
				// 		uri: vscode.Uri.file(activeFolderPath),
				// 		name: path.basename(activeFolderPath + ' (Active)')
				// 	}
				// );
				refreshWorkspaceFolderLabels(); 
				decorationProvider.updateState(activeFolderPath, folderDeviceMap);
			}catch (error) {
				vscode.window.showErrorMessage(
					'Error determining RIOT Base Path from Makefile.'
				);
			}
		}
	});

	async function refreshWorkspaceFolderLabels() {
		const currentFolders = vscode.workspace.workspaceFolders || [];
		const entries : {uri: vscode.Uri; name? : string}[] = [];

		for (const f of currentFolders) {
			const fPath = f.uri.fsPath;

			const name = path.normalize(activeFolderPath ?? '') === path.normalize(fPath) ? 
				path.basename(fPath) + ' (Active)' : path.basename(fPath); 
			entries.push({uri: f.uri, name});
		}
		if(activeFolderPath){
			const alreadyPresent = entries.some( e => path.normalize(e.uri.fsPath) === path.normalize(activeFolderPath ?? ''));
			if(!alreadyPresent) {
				entries.push({
					uri: vscode.Uri.file(activeFolderPath),
					name: path.basename(activeFolderPath) + ' (Active)'
				});
			}
			const exampleUri = vscode.Uri.file(activeFolderPath);
			await vscode.commands.executeCommand('revealInExplorer', exampleUri);
		}
		vscode.workspace.updateWorkspaceFolders(0, currentFolders.length, ...entries);
	}

	const setActiveExampleFolderDisposable = vscode.commands.registerCommand('riot-launcher.setActiveExampleFolder', async (uri: vscode.Uri) => {
		activeFolderPath = uri.fsPath;
		selectedDevice = folderDeviceMap.get(activeFolderPath);
		if(selectedDevice) {
			const compileTask = new VsCodeCompileCommandsTask(activeFolderPath, selectedDevice).getVscodeTask();
			if(!compileTask) {
				vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
				return;
			}
			vscode.tasks.executeTask(compileTask);
			configureCompiledCommands();
		}
		vscode.window.showInformationMessage(`Set Active Example Folder to: ${activeFolderPath}` + ' with Board: ' + (selectedDevice ?? 'None'));
		context.workspaceState.update(ACTIVE_FOLDER_KEY, activeFolderPath);
		refreshWorkspaceFolderLabels();
		decorationProvider.updateState(activeFolderPath, folderDeviceMap);
	});

	const setFolderDeviceDisposable = vscode.commands.registerCommand('riot-launcher.changeFolderDevice', async (uri: vscode.Uri) => {
		const selectedFolderPath = uri.fsPath;
		const devices = deviceProvider.getDevices();
		const picks = devices.map(d => ({
			label: d.label as string,
			description: d.portPath,
			detail: d.description,
			device: d
		}));

		const selection = await vscode.window.showQuickPick(picks, {
			placeHolder: 'Choose a device'
		});
		if(selection) {
			const pick = selection.device;
			riotDropDownBoard.text = `$(chefron-down) ${pick}`;
			selectedDevice = pick;

			vscode.window.showInformationMessage(`Selected Board: ${selectedDevice}`);
			if(selectedFolderPath) {
				folderDeviceMap.set(selectedFolderPath ?? '', selectedDevice);
				saveFolderMapState();

				vscode.window.showInformationMessage(`Associated Board "${selectedDevice}" with Folder "${activeFolderPath}".`);
				if(!selectedFolderPath || !selectedDevice) {
					vscode.window.showErrorMessage("Application folder or device not properly selected.");
					return;
				}
				if(selectedFolderPath === activeFolderPath) {
					const compileTask = new VsCodeCompileCommandsTask(activeFolderPath, selectedDevice).getVscodeTask();
					if(!compileTask) {
						vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
						return;
					}
					vscode.tasks.executeTask(compileTask);
				}
				decorationProvider.updateState(activeFolderPath, folderDeviceMap);
				saveFolderMapState();
				refreshWorkspaceFolderLabels();
			}
		}
	});

	context.subscriptions.push(setFolderDeviceDisposable);

	const selectBoardDisposable = vscode.commands.registerCommand('riot-launcher.selectBoard', async () => {
	 	const devices = deviceProvider.getDevices();
		const picks = devices.map(d => ({
			label: d.label as string,
			description: d.portPath,
			detail: d.description,
			device: d
		}));

		const selection = await vscode.window.showQuickPick(picks, {
			placeHolder: 'Choose a device'
		});
		if(selection) {
			const pick = selection.device;
			riotDropDownBoard.text = `$(chefron-down) ${pick}`;
			selectedDevice = pick;

			vscode.window.showInformationMessage(`Selected Board: ${selectedDevice.boardName}`);
			if(activeFolderPath) {
				folderDeviceMap.set(activeFolderPath ?? '', selectedDevice);
				saveFolderMapState();

				vscode.window.showInformationMessage(`Associated Board "${selectedDevice}" with Folder "${activeFolderPath}".`);
				if(!activeFolderPath || !selectedDevice) {
					vscode.window.showErrorMessage("Application folder or device not properly selected.");
					return;
				}
				const compileTask = new VsCodeCompileCommandsTask(activeFolderPath, selectedDevice).getVscodeTask();
				if(!compileTask) {
					vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
					return;
				}
				vscode.tasks.executeTask(compileTask);
				decorationProvider.updateState(activeFolderPath, folderDeviceMap);
			}
		}
	});

	const flashDisposable = vscode.commands.registerCommand('riot-launcher.riotFlash', () => {
		// flash(terminal);
		if(!activeFolderPath || !selectedDevice) {
			vscode.window.showErrorMessage("Application folder or device not properly selected.");
			return;
		}
		const flashTask = new VsCodeRiotFlashTask(activeFolderPath, selectedDevice).getVscodeTask();
		if(!flashTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
			return;
		}
		vscode.tasks.executeTask(flashTask);
	});

	const termDisposable = vscode.commands.registerCommand('riot-launcher.riotTerm', () => {
		if(!activeFolderPath || !selectedDevice) {
			vscode.window.showErrorMessage("Application folder or device not properly selected.");
			return;
		}
		const termTask = new VsCodeRiotTermTask(activeFolderPath, selectedDevice).getVscodeTask();
		if(!termTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
			return;
		}
		vscode.tasks.executeTask(termTask);

	});

	const searchPortsDisposable = vscode.commands.registerCommand('riot-launcher.detectPorts', async () => {
		const boardRegonizer = new BoardRecognizer (context, boards);
		const portDiscoverer = new PortDiscovery(boardRegonizer);
		const foundDevices = await portDiscoverer.discoverPorts();
		deviceProvider.refresh(foundDevices);
		saveDeviceListState();
	});


	context.subscriptions.push(flashDisposable);

	context.subscriptions.push(termDisposable);

	context.subscriptions.push(searchPortsDisposable);

	async function saveFolderMapState() {
		const toSave: Record<string, DeviceConfig> = {};
	
		for (const entry of folderDeviceMap) {
			toSave[entry[0]] = entry[1].toConfig();
		}

		await context.workspaceState.update(FOLDER_DEVICE_CACHE_KEY, toSave);
	}

	async function saveDeviceListState() {
		const currentDevices = deviceProvider.getDevices();
		const configList = currentDevices.map(d => d.toConfig());
		await context.workspaceState.update(DEVICE_LIST_CACHE_KEY, configList);
	}

	async function receiveRiotBasePath() {
		var type : string 	= "riotTaskProvider";
		const cDir : string = "cd " + activeFolderPath;
		const cDetermineRiot : string = "make info-debug-variable-RIOTBASE";

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cDetermineRiot);
		var task : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
                    "Set Path", "riot-launcher", execution);
		return task;
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

	async function configureCompiledCommands(){
		if(!riotBasePath || !activeFolderPath) {
			return; 
		}
		const config = vscode.workspace.getConfiguration('C_Cpp', vscode.Uri.file(activeFolderPath));

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

class CmdProvider {
	entries: { label: string; cmd: string; icon: string; }[];
	constructor() {
		this.entries = [
			{
				label : 'Select Example Folder',
				cmd: 'riot-launcher.selectExampleFolder',
				icon: 'file-directory'
			},
			{
				label : 'Detect Ports',
				cmd: 'riot-launcher.detectPorts',
				icon: 'compass'
			},
			{
				label : 'Select Board',
				cmd: 'riot-launcher.selectBoard',
				icon: 'keybindings-record-keys'
			},
			{
				label : 'Flash',
				cmd: 'riot-launcher.riotFlash',
				icon: 'zap'
			},
			{
				label : 'Term',
				cmd: 'riot-launcher.riotTerm',
				icon: 'terminal-powershell'
			}
		];			
	}
	getTreeItem(e: vscode.TreeItem) { return e; }
	getChildren() {
    	return Promise.resolve(this.entries.map(e => new CmdItem(e.label, e.cmd, e.icon)));
  	}
}
	
class RiotFileDecorationProvider implements vscode.FileDecorationProvider {
	private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
	readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

	private activeFolderPath: string | undefined;
	private folderDeviceMap = new Map<string, Device>();
	
	constructor(){}

	public updateState(activePath: string | undefined, folderDeviceMap: Map<string, Device>) {
		this.activeFolderPath = activePath;
		this.folderDeviceMap = folderDeviceMap;
		this._onDidChangeFileDecorations.fire(undefined);
	}

	provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.FileDecoration | undefined{
		const fsPath = uri.fsPath;

		const normalizedUriPath = path.normalize(fsPath);
		const normalizeActivePath = this.activeFolderPath ? path.normalize(this.activeFolderPath) : undefined;

		const isActive = normalizeActivePath === normalizedUriPath;
		const assignedBoard = this.folderDeviceMap.get(normalizedUriPath);

		if(isActive) {
			return {
				badge: 'A',
				tooltip: `Assigned Board: ${assignedBoard?.boardName} (Port: ${assignedBoard?.portPath ?? '?'})`,
				color: new vscode.ThemeColor('charts.blue'),
				propagate: false
			};
		}
	
		if(assignedBoard) {
			return {
				badge: 'B',
				tooltip: `Assigned Board: ${assignedBoard.boardName} (Port: ${assignedBoard?.portPath ?? '?'})`,
			};
		}

		return undefined;
	}
	
}

