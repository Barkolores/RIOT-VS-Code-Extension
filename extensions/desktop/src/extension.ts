// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as util from 'util';
import { realpathSync } from 'fs';
import * as path from 'path';
import { PortDiscovery } from './boards/PortDiscoverer';
import { DeviceModel, DeviceConfig } from '../../../shared/ui/deviceModel';
import { VsCodeCompileCommandsTask } from './tasks/VsCodeCompileCommandsTask';
import { VsCodeRiotTermTask } from './tasks/VsCodeRiotTermTask';
import { DesktopDeviceTreeItem } from './treeView/uiDevice';
import { VsCodeRiotDebugTask } from './tasks/VsCodeRiotDebugTask';
import { RiotFileDecorationProvider } from './treeView/uiFileDecorationProvider';
import { BoardTreeItem } from '../../../shared/ui/treeItems/boardTreeItem';
import { PortTreeItem } from '../../../shared/ui/treeItems/portTreeItem';
import { FolderTreeItem } from '../../../shared/ui/treeItems/folderTreeItem';
import { DeviceProvider } from '../../../shared/ui/deviceProvider';					
import { BoardRecognizer } from './boards/BoardRecognizer';
import { SerialPort } from 'serialport';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const DEVICE_LIST_CACHE_KEY = 'riot-launcher.deviceList';
	const ACTIVE_DEVICE_CACHE_KEY = 'riot-launcher.activeDevice';
	const VALID_RIOT_PATHS_CACHE_KEY = 'riot-launcher.validRiotAppPaths';
	const TRANSFER_DEVICES_KEY = 'riot-launcher.transferDevices';

	const transferDevices = context.globalState.get<DeviceConfig[]>(TRANSFER_DEVICES_KEY);


	let initialDevicesConfig = context.workspaceState.get<DeviceConfig[]>(DEVICE_LIST_CACHE_KEY, []);

	if (transferDevices && transferDevices.length > 0) {
        console.log("Restoring devices from Global State transfer...");
        initialDevicesConfig = transferDevices;
        
        await context.globalState.update(TRANSFER_DEVICES_KEY, undefined);
        
        await context.workspaceState.update(DEVICE_LIST_CACHE_KEY, initialDevicesConfig);
    }
	const activeDeviceConfig = context.workspaceState.get<DeviceConfig | undefined>(ACTIVE_DEVICE_CACHE_KEY, undefined);
	const validRiotAppPaths = context.workspaceState.get<string[]>(VALID_RIOT_PATHS_CACHE_KEY, []);

	const initialDevices : DeviceModel[] = initialDevicesConfig.map(d => DeviceModel.fromConfig(d));

	const devicesTreeItemProvider = new DeviceProvider(initialDevices);
	devicesTreeItemProvider.onDidChangeTreeData( () => {
		const currentDevices = devicesTreeItemProvider.getDeviceModels();
		const configsToSave = currentDevices.map(d => d.toConfig());
		const activeDevice = devicesTreeItemProvider.getActiveDevice();
		context.workspaceState.update(DEVICE_LIST_CACHE_KEY, configsToSave);
		context.workspaceState.update(ACTIVE_DEVICE_CACHE_KEY, activeDevice?.toConfig());
	});

	const colorProvider = new RiotFileDecorationProvider(validRiotAppPaths);

	if(activeDeviceConfig) {
		const matchedDevice = initialDevices.find( d => 
			d.appPath?.fsPath === activeDeviceConfig.appPath &&
			d.board?.id === activeDeviceConfig.board &&
			d.portPath === activeDeviceConfig.portPath
		);
		if(matchedDevice) {
			devicesTreeItemProvider.setActiveDevice(matchedDevice);
			colorProvider.updateActiveUri(matchedDevice);
		}
	}

	context.subscriptions.push(vscode.window.registerTreeDataProvider('riotView', devicesTreeItemProvider));

	context.subscriptions.push(vscode.window.registerFileDecorationProvider(colorProvider));

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
			
			if(boards.length > 0) {
				return boards;
			}else {
				throw new Error('No boards found in RIOT Path.');
			}
		} catch (error) {
			throw new Error('Error loading boards from RIOT Path.');
		}	
	}
	
	const flashDisposable = vscode.commands.registerCommand('riot-launcher.riotFlash', (d : DesktopDeviceTreeItem)=> {
		if(!d) { return; }
		d.flash();
	});

	context.subscriptions.push(flashDisposable);

	const termDisposable = vscode.commands.registerCommand('riot-launcher.riotTerm', (d : DesktopDeviceTreeItem) => {
		if(!d) { return; }
		const device = d.getDevice();
		const appPath = device.appPath;
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
	
	const debugDisposable = vscode.commands.registerCommand('riot-launcher.riotDebug', async (d: DesktopDeviceTreeItem) => {
		if(!d) { return; }
		const device = d.getDevice();
		const appPath = device.appPath;
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


	const changeBoardDisposable = vscode.commands.registerCommand('riot-launcher.changeBoardDevice', async (treeItem : BoardTreeItem) => {
		if(!treeItem) {
			vscode.window.showErrorMessage("Please execute this command via RIOT panel.");
		}
		const pick : string | undefined = await vscode.window.showQuickPick(boards, {
			title: 'Device configuration',
			placeHolder: 'Select new board for device'
		});
		
		if(pick) {
			treeItem.changeBoard({id : pick, name : pick});
			vscode.window.showInformationMessage(`Changed board of device to: ${pick}`);
			devicesTreeItemProvider.refresh();
			const device = treeItem.getDevice();

			if(device.portPath) {
				try {
					const availablePorts = await SerialPort.list();
					const portInfo = availablePorts.find( p => p.path === device.portPath);

					if(portInfo && portInfo.vendorId && portInfo.productId) {
						const recognizer = new BoardRecognizer (context, boards);
						const existingMatch = recognizer.recognizeBoard(portInfo.vendorId, portInfo.productId);
						if(!existingMatch || existingMatch.boardId !== pick) {
							const vid = portInfo.vendorId;
							const pid = portInfo.productId;

							const answer = await vscode.window.showInformationMessage(
								`Missmatch between product id and selected board. Do you want to update the assigned board to ${pick}?`,
								'Update', 'Keep'
							);
							if(answer === 'Update') {
								recognizer.addBoard({
									vendorId: vid.toLowerCase(),
									productId: pid.toLowerCase(),
									boardId: pick,
									boardName: pick
								});
								vscode.window.showInformationMessage(`Updated board assignment for port ${device.portPath} to board ${pick}.`);
							}
						}
					}
				}catch (error) {
					console.error("Error recognizing board after changing board: ", error);
				}

			}

			const appPath = device.appPath;
			executeCompileCommandsTask(device);
		}
	});

	context.subscriptions.push(changeBoardDisposable);

	const changeApplicationFolderDisposable = vscode.commands.registerCommand('riot-launcher.changeFolderDevice', async (treeItem : FolderTreeItem) => {
		const result = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Application Folder'
		});

		if (result && result.length > 0) {
			const appFolderUri = result[0];
			vscode.window.showInformationMessage(`Selected Example Folder: ${appFolderUri.fsPath}`);
			try {
				const { stdout } = await execAsync(
					`cd ${appFolderUri.fsPath} && make info-debug-variable-RIOTBASE`
				);
				const riotBasePath = vscode.Uri.file(stdout.toString().trim());
				
				colorProvider.addValidPath(appFolderUri);
				await context.workspaceState.update(VALID_RIOT_PATHS_CACHE_KEY, colorProvider.getAllPaths());

				loadBoards(appFolderUri).then((loadedBoards : string[]) => boards = loadedBoards);

				const isAlreadyOpen = vscode.workspace.workspaceFolders?.some( 
					folder => folder.uri.fsPath === appFolderUri.fsPath
				);
			
				treeItem.setAppPath(appFolderUri);
				treeItem.setBasePath(riotBasePath);
				
				devicesTreeItemProvider.refresh();

				const currentDevices = devicesTreeItemProvider.getDeviceModels();
                const configsToSave = currentDevices.map(d => d.toConfig());

                await context.globalState.update('riot-launcher.transferDevices', configsToSave);
                
                await context.workspaceState.update(DEVICE_LIST_CACHE_KEY, configsToSave);
                const activeDevice = devicesTreeItemProvider.getActiveDevice();
                
                await context.workspaceState.update(DEVICE_LIST_CACHE_KEY, configsToSave);
                await context.workspaceState.update(ACTIVE_DEVICE_CACHE_KEY, activeDevice?.toConfig());
				/* Compile commands and configuring IntelliSense */
				const device = treeItem.getDevice();
				if(device.board?.id)	 {
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
				colorProvider.removeValidPath(appFolderUri);
				await context.workspaceState.update(VALID_RIOT_PATHS_CACHE_KEY, colorProvider.getAllPaths());
				vscode.window.showErrorMessage(
					'Error determining RIOT Base Path from Makefile'
				);
				console.error(error);
			}
		}
	});

	context.subscriptions.push(changeApplicationFolderDisposable);

	const changePortDisposable = vscode.commands.registerCommand('riot-launcher.changePortDevice', async (treeItem : PortTreeItem) => {
		if(!treeItem) {
			vscode.window.showErrorMessage("Please execute this command via RIOT panel.");
			return;
		}
		interface PortPickItem extends vscode.QuickPickItem {
			portpath?: string;
			detectedBoardId?: string;
			detectedBoardName?: string;
			rawPortInfo?: any;
		}

		const quickPick = vscode.window.createQuickPick<PortPickItem>();
		quickPick.title = 'Device confiuration';
		quickPick.placeholder = 'Select a port...';
		// quickPick.matchOnDetail = true;

		const recognizer = new BoardRecognizer (context, boards);
		const rawPorts = await SerialPort.list();

		const validPorts = rawPorts.filter(port => port.path.includes('USB') || port.path.includes('COM') || port.path.includes('ACM'));
		
		const items: PortPickItem[] = [{ label: 'None', description: 'No port assigned'}];
		items.push(...validPorts.map(port => {
			const recognition = recognizer.recognizeBoard(port.vendorId, port.productId);
			const item : PortPickItem = {
				label: port.path,
				description: "Found port",
				detectedBoardId: recognition ? recognition.boardId :undefined,
				detectedBoardName: recognition ? recognition.boardName : undefined,
				portpath: port.path,
				rawPortInfo: port
			};
			if(recognition) {
				item.description = `Suggested: ${recognition.boardName}`;
				item.buttons = [
					{
						iconPath: new vscode.ThemeIcon('lightbulb'),
						tooltip: `Set suggested board: ${recognition.boardName}`
					}
				];
			}
			return item;
		}));

		items.push({ label: 'Custom...', description: 'Type manually'});
		quickPick.items = items;

		const updateDevice = async (portPath: string, boardId?: string, boardName?: string, details? : string[]) => {
			treeItem.changePortPath(portPath);
			let msg = `Changed port of device to: ${portPath}`;
			const device = treeItem.getDevice();
			if(boardId && boardName) {
				device.board = {id: boardId, name: boardName};
				await executeCompileCommandsTask(device);
				msg += ` and board to: ${boardName}`;
			}
			device.description = details;
			vscode.window.showInformationMessage(msg);
			devicesTreeItemProvider.refresh();
			quickPick.dispose();
		};

		quickPick.onDidTriggerItemButton(async (e) => {
			const item = e.item;
			if(item.detectedBoardId && item.detectedBoardName && item.portpath) {
				let details : string[] | undefined = undefined;
				if(item.rawPortInfo) {
					details = determineDetails(item.rawPortInfo);
				}
				await updateDevice(item.portpath, item.detectedBoardId, item.detectedBoardName, details);
			}
		});

		quickPick.onDidAccept( async () => {
			const selected = quickPick.selectedItems[0];
			if(!selected) {
				return;
			}
			if(selected.label === 'Custom...') {
				quickPick.dispose();
				const customPort = await vscode.window.showInputBox({
					title: 'Device configuration',
					prompt: 'Enter new port path',
					value: treeItem.getDevice().appPath?.fsPath
				});
				if(customPort) {
					await updateDevice(customPort);
				}
			}else if (selected.label === 'None') {
				await updateDevice('None', undefined, undefined, undefined);
			} else{
				let details : string[] | undefined = undefined;
				if(selected.rawPortInfo) {
					details = determineDetails(selected.rawPortInfo);
				}
				await updateDevice(selected.portpath ?? 'Error', undefined, undefined, details);
			}
		});

		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	
		const determineDetails = (portInfo : any) : string [] => {
			let details : string[] = [];
			if(portInfo.manufacturer) { 
				details.push(`Manufacturer: ${portInfo.manufacturer}`);
			}
			if(portInfo.serialNumber) {
				details.push(`Serial Number: ${portInfo.serialNumber}`);
			}
			if(portInfo.vendorId) {
				details.push(`Vendor ID: ${portInfo.vendorId}`);
			}
			if(portInfo.productId) {
				details.push(`Product ID: ${portInfo.productId}`);
			}
			if(portInfo.pnpId) {
				details.push(`PNP ID: ${portInfo.pnpId}`);
			}
			if(portInfo.locationId) {
				details.push(`Location ID: ${portInfo.locationId}`);
			}
			return details;
		};
	});
	
	context.subscriptions.push(changePortDisposable);

	const forgetDeviceDisposable = vscode.commands.registerCommand('riot-launcher.forgetDevice', async (d : DesktopDeviceTreeItem) => {
		devicesTreeItemProvider.removeDevice(d);
		devicesTreeItemProvider.refresh();
	});

	const setDeviceActiveDisposable = vscode.commands.registerCommand('riot-launcher.setActive', async (d : DesktopDeviceTreeItem) => {
		executeCompileCommandsTask(d.getDevice());
	});

	const changeDescriptionDisposable = vscode.commands.registerCommand('riot-launcher.changeDescriptionDevice', async (d : DesktopDeviceTreeItem) => {
		if(!d) {
			vscode.window.showErrorMessage("Please execute this command via RIOT panel.");
		}
		const descriptionInput : string | undefined = await vscode.window.showInputBox({
			title: 'Device configuration',
			prompt: 'Enter new description for device',
			value: d.getTitle()
		});
		
		if(descriptionInput !== undefined) {
			d.setTitle(descriptionInput);
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
		const riotBasePath = device.riotBasePath;
		const appFolderPath = device.appPath;
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
	
		devicesTreeItemProvider.setActiveDevice(device);
		colorProvider.updateActiveUri(device);
		context.workspaceState.update(ACTIVE_DEVICE_CACHE_KEY, device.toConfig());
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
		const appPath = device.appPath;
		const boardName = device.board?.id || 'native64';
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


		

