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
import { Device } from '../../../shared/types/device';
import { VsCodeRiotDebugTask } from './tasks/VsCodeRiotDebugTask';
					
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const DEVICE_LIST_CACHE_KEY = 'riot-launcher.deviceList';
	
	const initialDevicesConfig = context.workspaceState.get<DeviceConfig[]>(DEVICE_LIST_CACHE_KEY, []	);

	const initialDevices : DeviceModel[] = initialDevicesConfig.map(d => DeviceModel.fromConfig(d));
	
	const devicesTreeItemProvider = new DeviceTreeItemProvider(initialDevices);
	devicesTreeItemProvider.onDidChangeTreeData( () => {
		const currentDevices = devicesTreeItemProvider.getDeviceModels();
		const configsToSave = currentDevices.map(d => d.toConfig());
		context.workspaceState.update(DEVICE_LIST_CACHE_KEY, configsToSave);
	});
	context.subscriptions.push(vscode.window.registerTreeDataProvider('riotView', devicesTreeItemProvider));

	let currentDebugServerTaskExecution : vscode.TaskExecution | undefined = undefined;

	context.subscriptions.push(vscode.debug.onDidTerminateDebugSession( (session) =>{
		if(session.name.startsWith('RIOT Debug') && currentDebugServerTaskExecution) {
			try {
				currentDebugServerTaskExecution.terminate();
				vscode.window.showInformationMessage("Debug server task terminated.");
			}catch (error) {
				console.error("Error terminating debug server task: ", error);
			}
			currentDebugServerTaskExecution = undefined;
		}
	}));

	async function readBundledBoards(): Promise<string[]> {
		const fileUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'boards.txt');
		const text : string = await fs.promises.readFile(fileUri.fsPath, 'utf8');
		console.log("read boards " + text);
		return text.split('\n').filter(line => line.length > 0);
	}

	let boards : string[] = await readBundledBoards().catch<string[]>( (_err) => ['native64'] );

	const riotDropDownBoard = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left, 101
	);

	context.subscriptions.push(riotDropDownBoard);

	const addDeviceDisposable = vscode.commands.registerCommand('riot-launcher.addDevice', async (device : DeviceModel) => {
		devicesTreeItemProvider.addDevice(devicesTreeItemProvider.createDeviceTreeItem(new DeviceModel(undefined, undefined, undefined, undefined)));
	});
	context.subscriptions.push(addDeviceDisposable);

	const execAsync = util.promisify(exec);

	async function loadBoards(appPath: vscode.Uri): Promise<string[]> {
		try {
			const { stdout } = await execAsync(
				`cd "${appPath.fsPath}" && make info-boards`
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
		d.flash();
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
		const termTask = new VsCodeRiotTermTask(appPath.fsPath, device).getVscodeTask();
		if(!termTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
			return;
		}
		vscode.tasks.executeTask(termTask);
	});

	context.subscriptions.push(termDisposable);
	
	const debugDisposable = vscode.commands.registerCommand('riot-launcher.riotDebug', async (d: DeviceTreeItem) => {
		if(!d) { return; }
		const device = d.getDevice();
		const appPath = device.getAppPath();
		if(!appPath || !device) {
			vscode.window.showErrorMessage("Application folder or device not properly selected.");
			return;
		}
		
		const debugTask = new VsCodeRiotDebugTask(appPath.fsPath, device).getVscodeTask();
		if(!debugTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Debug Task");
			return;
		}
		try {
			currentDebugServerTaskExecution = await vscode.tasks.executeTask(debugTask);
			startDebugging(device);
		} catch (error) {
			vscode.window.showErrorMessage("Error starting debug task: " + error);
		}
	});


	context.subscriptions.push(debugDisposable);
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
				const compileTask = new VsCodeCompileCommandsTask(appPath.fsPath, treeItem.getDevice()).getVscodeTask();
				if(!compileTask) {
					vscode.window.showErrorMessage("Something went wrong creating the Flash Task");
					return;
				}
				vscode.tasks.executeTask(compileTask);
				const riotBasePath = device.getRiotBasePath();
				if(riotBasePath) {
					configureCompiledCommands(riotBasePath.fsPath, appPath.fsPath);
				}
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
			const appFolderUri = result[0];
			vscode.window.showInformationMessage(`Selected Example Folder: ${appFolderUri}`);
			try {
				const { stdout } = await execAsync(
					`cd ${appFolderUri.fsPath} && make info-debug-variable-RIOTBASE`
				);
				const riotBasePath = vscode.Uri.file(stdout.toString().trim());
				loadBoards(appFolderUri).then((loadedBoards : string[]) => boards = loadedBoards);

				const isAlreadyOpen = vscode.workspace.workspaceFolders?.some( 
					folder => folder.uri.fsPath === appFolderUri.fsPath
				);
			
				treeItem.setAppPath(appFolderUri);
				treeItem.setBasePath(riotBasePath);
				
				devicesTreeItemProvider.refresh();
				/* Compile commands and configuring IntelliSense */
				const device = treeItem.getDevice();
				if(device.getBoardName())	 {
					if(isAlreadyOpen) {
						await executeCompileCommandsTask(device);
					} else {
						/* Set up event that ensures, compile-commands and configuring IntelliSense is
						configured subsequentially after opening the workspace folder 
						... Otherwise leads to a race condition */ 
						const listener = vscode.workspace.onDidChangeWorkspaceFolders( async (e) => { 
							const addedFolder = e.added.find(folder => folder.uri === appFolderUri);
							if(addedFolder) {
								listener.dispose();
								await executeCompileCommandsTask(device);
							}
						});
					}
				}

				/* Add folder to workspace*/ 
				vscode.workspace.updateWorkspaceFolders(
						vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
						0,
						{ uri: appFolderUri }
				);
				// TODO Include logic of inserting RIOT base folder here in case a nested RIOT example is selected
			}catch (error) {
				vscode.window.showErrorMessage(
					'Error determining RIOT Base Path from Makefile'
				);
				console.error(error);
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

	const forgetDeviceDisposable = vscode.commands.registerCommand('riot-launcher.forgetDevice', async (d : DeviceTreeItem) => {
		devicesTreeItemProvider.removeDevice(d);
		devicesTreeItemProvider.refresh();
	});

	const changeDescriptionDisposable = vscode.commands.registerCommand('riot-launcher.changeDescriptionDevice', async (d : DeviceTreeItem) => {
		if(!d) {
			vscode.window.showErrorMessage("Please execute this command via RIOT panel.");
		}
		const descriptionInput : string | undefined = await vscode.window.showInputBox({
			title: 'Device configuration',
			prompt: 'Enter new description for device',
			value: d.getDesktopDescription()
		});
		
		if(descriptionInput !== undefined) {
			d.setDescription(descriptionInput);
			vscode.window.showInformationMessage(`Changed description of device to: ${descriptionInput}`);
			devicesTreeItemProvider.refresh();
		}
	});


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

	async function executeCompileCommandsTask(device: DeviceModel) {
		const riotBasePath = device.getRiotBasePath();
		const appFolderPath = device.getAppPath();
		if(!appFolderPath || !riotBasePath) {
			return;
		}
		const compileTask = new VsCodeCompileCommandsTask(appFolderPath.fsPath, device).getVscodeTask();
		if(!compileTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Compile Task");
			return;
		}
		vscode.tasks.executeTask(compileTask);
		await configureCompiledCommands(riotBasePath.fsPath, appFolderPath.fsPath);
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
		}else {
			vscode.window.showInformationMessage("Compiled commands already set");
		}
	}

	async function startDebugging(device: DeviceModel) {
		const appPath = device.getAppPath();
		const boardName = device.getBoardName() || 'native64';
		const isNative : boolean = boardName.startsWith('native');
		if(!appPath) {
			vscode.window.showErrorMessage("Application folder not properly selected.");
			return;
		}

		const vscodeFolderUri = vscode.Uri.joinPath(appPath, '.vscode');
		const launchJsonUri = vscode.Uri.joinPath(vscodeFolderUri, 'launch.json');
	
		if(!fs.existsSync(vscodeFolderUri.fsPath)) {
			await fs.promises.mkdir(vscodeFolderUri.fsPath, { recursive: true});
		}

		const appName = path.basename(appPath.fsPath);
		const programPath = path.join(`\${workspaceFolder}/bin/${boardName}/${appName}.elf`);
		const debugConfigName = `RIOT Debug (${boardName})`;

		const launchConfig = {
			name : debugConfigName,
			type : 'cppdbg',
			request : 'launch',
			program : programPath,
			args : [],
			cwd : '${workspaceFolder}',
			environment : [],
			MIMode : 'gdb',
			miDebuggerPath : isNative ? 'gdb' :'gdb-multiarch',
			setupCommands : [
				{
					description: 'Enable pretty-description for gdb',
					text: '-enable pretty-printing',
					ignoreFailures: true
				},
			]
		};
		if(!isNative) {
			launchConfig.setupCommands.push(				{
					description: 'Connect to GDB Server explicitely',
					text: 'target remote localhost:3333',
					ignoreFailures: false
				},
				{
					description : 'Reset and halt the device',
					text : 'monitor reset halt',
					ignoreFailures : false
				},
				{
					description : 'Load Symbols',
					text: `file ${programPath}`,
					ignoreFailures : true 
				}
			);
		}
		let launchConfigs : any = { version : '0.2.0', configurations : [] };
		if(fs.existsSync(launchJsonUri.fsPath)) {
			const launchJsonText = await fs.promises.readFile(launchJsonUri.fsPath, 'utf8');
			launchConfigs = JSON.parse(launchJsonText);
		}	
		const configExists = launchConfigs.configurations.some( (c : any) => c.name === debugConfigName);
		if(!configExists) {
			launchConfigs.configurations.push(launchConfig);
			await fs.promises.writeFile(launchJsonUri.fsPath, JSON.stringify(launchConfigs, null, 2));
			vscode.window.showInformationMessage(`Debug configuration added to ${launchJsonUri.fsPath}`);
		}
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(appPath.fsPath));
		if(workspaceFolder) {
			await vscode.debug.startDebugging(
				workspaceFolder,
				debugConfigName
			);
		}else {
			vscode.window.showErrorMessage("Workspace folder for debugging not found");
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

		

