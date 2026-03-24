// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as util from 'util';
import { realpathSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DeviceModel, DeviceConfig } from './treeView/deviceModel';
import { VsCodeCompileCommandsTask } from './tasks/VsCodeCompileCommandsTask';
import { VsCodeRiotTermTask } from './tasks/VsCodeRiotTermTask';
import { DesktopDeviceTreeItem } from './treeView/uiDevice';
import { VsCodeRiotDebugTask } from './tasks/VsCodeRiotDebugTask';
import { BoardTreeItem } from '../../../shared/ui/treeItems/boardTreeItem';
import { PortTreeItem } from '../../../shared/ui/treeItems/portTreeItem';
import { FolderTreeItem } from '../../../shared/ui/treeItems/folderTreeItem';
import { SerialPort } from 'serialport';
import { RiotFileTreeProvider } from './treeView/uiFileTreeProvider';
import { RiotBaseFileTreeProvider } from './treeView/uiBaseFileTreeProvider';
import { VsCodeRiotCleanTask } from './tasks/VsCodeRiotCleanTask';
import { DesktopDeviceProvider } from './treeView/uiDesktopDeviceProvider';
import { VsCodeRiotBuildTask } from './tasks/VsCodeRiotBuildTask';


interface ActiveDebugSession {
	gdbPort: number;
	telnetPort: number;
	tclPort: number;
	taskExecution: vscode.TaskExecution;
	debugSessionId?: string;
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const execAsync = util.promisify(exec);

	checkAndInstallRiotgen();
	checkAndPromptSystemTools();

	const DEVICE_LIST_CACHE_KEY = 'riot-launcher.deviceList';
	const ACTIVE_DEVICE_CACHE_KEY = 'riot-launcher.activeDevice';


	const activeDebugSessions: ActiveDebugSession[] = [];
	function getNextAvailablePort(): { gdbPort: number; telnetPort: number; tclPort: number } {
		let port = 3333; // Starting port
		let telnetPort = 4444;
		let tclPort = 5555;
		while (activeDebugSessions.some(session => session.gdbPort === port || session.telnetPort === telnetPort || session.tclPort === tclPort)) {
			port++;
			telnetPort++;
			tclPort++;
		}
		return { gdbPort: port, telnetPort, tclPort };
	}

	let initialDevicesConfig = context.workspaceState.get<DeviceConfig[]>(DEVICE_LIST_CACHE_KEY, []);
	const activeDeviceConfig = context.workspaceState.get<DeviceConfig | undefined>(ACTIVE_DEVICE_CACHE_KEY, undefined);

	const initialDevices : DeviceModel[] = initialDevicesConfig.map(d => DeviceModel.fromConfig(d));


	const devicesTreeItemProvider = new DesktopDeviceProvider(initialDevices);
	devicesTreeItemProvider.onDidChangeTreeData( () => {
		const currentDevices = devicesTreeItemProvider.getDeviceModels();
		const configsToSave = currentDevices.map(d => d.toConfig());
		const activeDevice = devicesTreeItemProvider.getActiveDevice();
		context.workspaceState.update(DEVICE_LIST_CACHE_KEY, configsToSave);
		context.workspaceState.update(ACTIVE_DEVICE_CACHE_KEY, activeDevice?.toConfig());
	});

	const riotFileTreeProvider = new RiotFileTreeProvider(context.extensionUri);
	const treeView = vscode.window.createTreeView('riotFileView', {
		treeDataProvider: riotFileTreeProvider
	});

	const riotBaseTreeProvider = new RiotBaseFileTreeProvider();
	const riotBaseTreeView =vscode.window.createTreeView('riotBaseFileView', {
		treeDataProvider: riotBaseTreeProvider
	});

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if(editor && editor.document.uri.scheme === 'file') {
				treeView.reveal(editor.document.uri, { focus: true, select: true, expand: true});
			}
		})
	);

	initialDevices.forEach(device => {
		if(device.appPath) {
			riotFileTreeProvider.addAppFolder(device.appPath);
		}
	});

	//TODO Definitely clean this if-hell up
	if(activeDeviceConfig) {
		const matchedDevice = initialDevices.find( d => 
			d.appPath?.fsPath === activeDeviceConfig.appPath &&
			d.board === activeDeviceConfig.board &&
			d.portPath === activeDeviceConfig.portPath
		);
		if(matchedDevice) {
			devicesTreeItemProvider.setActiveDevice(matchedDevice);
			if(matchedDevice.appPath) {
				riotFileTreeProvider.setActiveAppUri(matchedDevice.appPath);
			}
			if(matchedDevice.riotBasePath) {
				riotBaseTreeProvider.refresh(matchedDevice.riotBasePath);
				riotBaseTreeView.description = matchedDevice.riotBasePath.fsPath;
			}else {
				checkAndCloneRiotBase();
			}
		}else {
			checkAndCloneRiotBase();
		}
		
	}else {	
		checkAndCloneRiotBase();
	}

	context.subscriptions.push(vscode.window.registerTreeDataProvider('riotView', devicesTreeItemProvider));

	context.subscriptions.push(vscode.debug.onDidTerminateDebugSession( (session) =>{
		const sessionIndex = activeDebugSessions.findIndex(s => s.debugSessionId === session.id
			|| session.name.includes(`Port ${s.gdbPort}`)
		);
		if(sessionIndex !== -1) {
			const terminatedSession = activeDebugSessions[sessionIndex];
			try {
				terminatedSession.taskExecution.terminate();
				console.log(`Terminated debug server task for session ${session.name}`);
			}catch(error) {
				console.log(`Error terminating debug server task for session ${session.name}: `, error);
			}
		}
		activeDebugSessions.splice(sessionIndex, 1);
	}));

	

	async function readBundledBoards(): Promise<string[]> {
		const fileUri = vscode.Uri.joinPath(context.extensionUri, 'resources', 'boards.txt');
		const text : string = await fs.promises.readFile(fileUri.fsPath, 'utf8');
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

	async function checkSystemDependency(command: string): Promise<boolean> {
		try{
			await execAsync(`${command} --version`);
			return true;
		}catch (error) {
			return false;
		}
	}
	
	async function checkAndPromptSystemTools() {
		const platform = os.platform();
		const gdbCmd = platform === 'linux' ? 'gdb-multiarch' : 'arm-none-eabihf-gdb';
		const tools = [
			{ name: 'GDB (ARM)', cmd: gdbCmd, key: 'gdb'},
			{ name: 'OpenOCD', cmd: 'openocd', key: 'openocd'},
		];

		for (const tool of tools) {
			const isInstalled = await checkSystemDependency(tool.cmd);
			if(!isInstalled) {
				const guideOption = 'View Installation Guide';
				const response = await vscode.window.showWarningMessage(
					`${tool.name} is required but not found on your system. Please install it to enable full functionality.`,
					guideOption, "Later"
				);
				if(response === guideOption) {	
					showInstallInstructions(tool.name, platform);
				}
			}
		}
	}

	function showInstallInstructions(toolName: string, platform: string) {
		let message = '';
		let terminalCommand = '';
		if(platform === 'linux') {
			if(toolName.includes('gdb')) {
				message = 'You can install gdb-multiarch using your package manager.';
				terminalCommand = 'sudo apt install gdb-multiarch';
			} else if (toolName.includes('openocd')) {
				message = 'You can install OpenOCD using your package manager.';
				terminalCommand = 'sudo apt install openocd';
			}
		}else if(platform === 'darwin') {
			if(toolName.includes('gdb')) {
				message = 'You can install gdb using Homebrew.';
				terminalCommand = 'brew install arm-none-eabi-gdb';
			} else if (toolName.includes('openocd')) {
				message = 'You can install OpenOCD using Homebrew.';
				terminalCommand = 'brew install openocd';
			}
		}else if(platform === 'win32') {
			message = `Please use a WSL terminal to install ${toolName} or refer to the official installation guides as Windows is not natively supported.`;
		}
		if(terminalCommand) {
			vscode.window.showInformationMessage(message, {modal : true}, 'Command copied to clipboard').then( (selection) => {
				if(selection === 'Command copied to clipboard') {
					vscode.env.clipboard.writeText(terminalCommand);
					vscode.window.showInformationMessage('Installation command copied to clipboard. Please paste it in your terminal to install the required tool.');
				}
			});
		}else {
			vscode.window.showInformationMessage(message, {modal : true});
		}
	}

	async function checkAndInstallRiotgen() {
		try {
			await execAsync('riotgen --version');
		}catch (error) {
			console.log('riotgen not found, prompting user to install: ', error);
			const installOption = 'Install riotgen (pip)';
			const response = await vscode.window.showErrorMessage('The tool riotgen is required but not found in your system. Please install it to use the application creation feature.',
				installOption, "Later"
			);
			if (response === installOption) {
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Installing riotgen',
					cancellable: false
				}, async (progress) => {
					try {
						await execAsync('pip install riotgen');
						vscode.window.showInformationMessage('Successfully installed riotgen!');
					} catch(installError) {
						vscode.window.showErrorMessage('Failed to install riotgen. Please try installing it manually via pip.');
						console.log('Error installing riotgen: ', installError);
					}
				});
			}
		}
	}

	async function checkAndCloneRiotBase() {
		const cloneOption = 'Clone RIOT from GitHub';
		const response = await vscode.window.showInformationMessage('RIOT Base folder is not set. Make sure the RIOT Base is cloned on your system.',
			cloneOption, "Later"
		);
		if(response === cloneOption) {
			const targetDir = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select Target Directory for RIOT clone'
			});
			if(targetDir && targetDir[0]) {
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Cloning RIOT Base',
					cancellable: true
				}, async (progress) => {
					try {
						const targetPath = targetDir[0].fsPath;
						await execAsync(`git clone https://github.com/RIOT-OS/RIOT.git "${targetPath}"`);
						riotBaseTreeProvider.refresh(vscode.Uri.file(targetPath));
						riotBaseTreeView.description = targetPath;
						vscode.window.showInformationMessage('Successfully cloned RIOT Base and updated configuration!');
						return vscode.Uri.file(targetPath);
					} catch(cloneError) {
						vscode.window.showErrorMessage('Failed to clone RIOT Base. Please try cloning it manually.');
						console.log('Error cloning RIOT Base: ', cloneError);
						return undefined;
					}
				});
			}
		}
	}

	context.subscriptions.push(vscode.tasks.onDidEndTaskProcess(async (e) => {
		const taskName = e.execution.task.name.toLowerCase();
		if(taskName.includes('build') || taskName.includes('flash')) {
			const activeDevice = devicesTreeItemProvider.getActiveDevice();
			if(activeDevice && activeDevice.appPath && activeDevice.board) {
				try {
					const { stdout } = await execAsync(`make info-buildsize BOARD=${activeDevice.board}`,
						{ cwd: activeDevice.appPath.fsPath }
					);
					const lines = stdout.toString().trim().split('\n').filter(line => line.trim().length > 0);
					const dataLine = lines[lines.length - 1].trim().split(/\s+/);
					console.log('Build size info: ', dataLine);
					if(dataLine.length >= 3) {
						const text = parseInt(dataLine[0], 10);
						const data = parseInt(dataLine[1], 10);
						const bss = parseInt(dataLine[2], 10);
						if(!isNaN(text) && !isNaN(data) && !isNaN(bss)) {
							const appRam = data + bss;
							const appRom = text + data;
							updateDeviceMemoryUi(activeDevice as any, {appRom, appRam});
							devicesTreeItemProvider.refresh();
						}
					}
				}catch (error) {
					console.log('Error fetching build size info: ', error);
				}
			}
		}
	}));

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
	
	let clipBoardUri: vscode.Uri | undefined = undefined;
	let isCutOperation : boolean = false;

	const copyRelPathDisposable = vscode.commands.registerCommand('riotFileView.copyRelativePath', async (uri: vscode.Uri) => {
		if(!uri) { return; }
		const relativePath = vscode.workspace.asRelativePath(uri, false);
		await vscode.env.clipboard.writeText(relativePath);
	});
	context.subscriptions.push(copyRelPathDisposable);

	const copyDisposable = vscode.commands.registerCommand('riotFileView.copyFile', async (uri: vscode.Uri) => {
		if(!uri) { return; }
		clipBoardUri = uri;
		isCutOperation = false;

		await vscode.env.clipboard.writeText(uri.fsPath);
		vscode.window.showInformationMessage('File path copied to clipboard');
	});
	context.subscriptions.push(copyDisposable);

	const cutDisposable = vscode.commands.registerCommand('riotFileView.cutFile', async (uri: vscode.Uri) => {
		if(!uri) { return; }
		clipBoardUri = uri;
		isCutOperation = true;
	
		await vscode.env.clipboard.writeText(uri.fsPath);
		vscode.window.showInformationMessage('File path copied to clipboard. Ready to move.');
	});
	context.subscriptions.push(cutDisposable);

	const newFileDisposable = vscode.commands.registerCommand('riotFileView.newFile', async (uri: vscode.Uri) => {
		if(!uri) { return; }
		const fileName = await vscode.window.showInputBox({
			prompt: 'Enter the name of the new file',
			placeHolder: 'main.c',
		});
		if(fileName) {
			const newFileUri = vscode.Uri.joinPath(uri, fileName);
			try {
				await vscode.workspace.fs.writeFile(newFileUri, new Uint8Array(0));
				const doc = await vscode.workspace.openTextDocument(newFileUri);
				await vscode.window.showTextDocument(doc);
				riotFileTreeProvider.refresh();
			}catch (error) {
				vscode.window.showErrorMessage('Error creating file: ' + error);
			}
		}
	});
	context.subscriptions.push(newFileDisposable);

	const deleteDisposable = vscode.commands.registerCommand('riotFileView.deleteFile', async (uri: vscode.Uri) => {
		if(!uri) { return; }
		const fileName = path.basename(uri.fsPath);
		const confirm = await vscode.window.showWarningMessage(
			`Are you sure you want to delete ${fileName}?`,
			{ modal: true },
			'Yes'
		);
		if(confirm === 'Yes') {
			try {
				await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
				riotFileTreeProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage('Error deleting file: ' + error);
			}
		}
	});
	context.subscriptions.push(deleteDisposable);

	const pasteDisposable = vscode.commands.registerCommand('riotFileView.pasteFile', async (uri: vscode.Uri) => {
		if(!uri || !clipBoardUri) { return; }
		
		const clipboardText = await vscode.env.clipboard.readText();

		let sourceUri: vscode.Uri | undefined = undefined;

		if (clipboardText && fs.existsSync(clipboardText.trim())) {
			sourceUri = vscode.Uri.file(clipboardText.trim());
		} else if (clipBoardUri) {
			sourceUri = clipBoardUri;
		}
		if(!sourceUri) {
			return;
		}

		let targetDir = uri;
		try {
			const stat = await vscode.workspace.fs.stat(uri);
			if(stat.type !== vscode.FileType.Directory) {
				targetDir = vscode.Uri.file(path.dirname(uri.fsPath));		
			}
		} catch (error) {
			vscode.window.showErrorMessage('Error pasting file: ' + error);
			return;
		}
		const fileName = path.basename(clipBoardUri.fsPath);
		const finalTargetUri = vscode.Uri.joinPath(targetDir, fileName);
		try {
			if(isCutOperation && sourceUri.fsPath === clipBoardUri?.fsPath) {
				await vscode.workspace.fs.rename(clipBoardUri, finalTargetUri, { overwrite: false });
				clipBoardUri = undefined;
				isCutOperation = false;
			} else {
				await vscode.workspace.fs.copy(clipBoardUri, finalTargetUri, { overwrite: false });
			}
			riotFileTreeProvider.refresh();
		} catch (error) {
			vscode.window.showErrorMessage('Error pasting file: ' + error);
		}
	});
	context.subscriptions.push(pasteDisposable);

	const flashDisposable = vscode.commands.registerCommand('riot-launcher.riotFlash', (d : DesktopDeviceTreeItem)=> {
		if(!d) { return; }
		d.flash();
	});
	context.subscriptions.push(flashDisposable);

	const buildDisposable = vscode.commands.registerCommand('riot-launcher.riotBuild', async (d : DesktopDeviceTreeItem) => {
		if(!d) { return; }
		const device = d.getDevice();
		const appPath = device.appPath;
		if(!appPath || !device) {
			vscode.window.showErrorMessage("Application folder or device not properly selected.");
			return;
		}
		const buildTask = new VsCodeRiotBuildTask(appPath.fsPath, device).getVscodeTask();
		if(!buildTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Build Task");
			return;
		}
		vscode.tasks.executeTask(buildTask);
	});
	context.subscriptions.push(buildDisposable);

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
	
	const cleanDisposable = vscode.commands.registerCommand('riot-launcher.riotClean', (d : DesktopDeviceTreeItem) => {const device = d.getDevice();
		const appPath = device.appPath;
		if(!appPath || !device) {
			vscode.window.showErrorMessage("Application folder or device not properly selected.");
			return;
		}
		const cleanTask = new VsCodeRiotCleanTask(appPath.fsPath, device).getVscodeTask();
		if(!cleanTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Clean Task");
			return;
		}
		vscode.tasks.executeTask(cleanTask);
	});
	
	const debugDisposable = vscode.commands.registerCommand('riot-launcher.riotDebug', async (d: DesktopDeviceTreeItem) => {
		if(!d) { return; }
		const device = d.getDevice();
		const appPath = device.appPath;
		if(!appPath || !device) {
			vscode.window.showErrorMessage("Application folder or device not properly selected.");
			return;
		}
		const ports = getNextAvailablePort();
		const debugTask = new VsCodeRiotDebugTask(appPath.fsPath, device, ports.gdbPort, ports.telnetPort, ports.tclPort).getVscodeTask();
		if(!debugTask) {
			vscode.window.showErrorMessage("Something went wrong creating the Debug Task");
			return;
		}
		try {
			const execution = await vscode.tasks.executeTask(debugTask);
			const newSession: ActiveDebugSession = {...ports, taskExecution: execution};
			activeDebugSessions.push(newSession);
			startDebugging(device, newSession);
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
			return;
		}
		const RECENT_BOARDS_KEY = 'riot-launcher.recentBoards';
		const recentBoards = context.globalState.get<string[]>(RECENT_BOARDS_KEY, []);

		const quickPickItems : vscode.QuickPickItem[] = [];
		if(recentBoards.length > 0) {
			quickPickItems.push({
				label: 'Recently Used',
				kind: vscode.QuickPickItemKind.Separator
			});
			recentBoards.forEach(board => {
				quickPickItems.push({ label : board});
			});
		}
		quickPickItems.push({
			label: 'All Boards',
			kind: vscode.QuickPickItemKind.Separator
		});
		boards.forEach(board => {
			if(!recentBoards.includes(board)) {
				quickPickItems.push({ label : board});
			}
		});

		const pick : vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(quickPickItems, {
			title: 'Device configuration',
			placeHolder: 'Select new board for device'
		});
		
		if(pick) {
			const selectedBoard = pick.label;
			const updateRecents = [
				selectedBoard,
				...recentBoards.filter(b => b !== selectedBoard)
			].slice(0, 5);
			await context.globalState.update(RECENT_BOARDS_KEY, updateRecents);
			(treeItem.getParentDevice() as DesktopDeviceTreeItem).setBoard(selectedBoard);
			vscode.window.showInformationMessage(`Changed board of device to: ${selectedBoard}`);
            devicesTreeItemProvider.refresh();
            const device = (treeItem.getParentDevice() as DesktopDeviceTreeItem).getDevice();
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
			const desktopDeviceItem = treeItem.getParentDevice() as DesktopDeviceTreeItem;
			const oldAppPath = desktopDeviceItem.getDevice().appPath;

			riotFileTreeProvider.addAppFolder(appFolderUri);
			desktopDeviceItem.setAppPath(appFolderUri);

			devicesTreeItemProvider.refresh();
			if(oldAppPath && oldAppPath.fsPath !== appFolderUri.fsPath) {
				cleanupUnusedAppFolder(oldAppPath);
			}
            vscode.window.showInformationMessage(`Selected Example Folder: ${appFolderUri.fsPath}`);
			try {
				const { stdout } = await execAsync(
					`cd ${appFolderUri.fsPath} && make info-debug-variable-RIOTBASE`
				);
				const riotBasePath = vscode.Uri.file(stdout.toString().trim());
				
				loadBoards(appFolderUri).then((loadedBoards : string[]) => boards = loadedBoards);

			
				(treeItem.getParentDevice() as DesktopDeviceTreeItem).setAppPath(appFolderUri);
				(treeItem.getParentDevice() as DesktopDeviceTreeItem).setRiotBasePath(riotBasePath);
				
				devicesTreeItemProvider.refresh();

				const currentDevices = devicesTreeItemProvider.getDeviceModels();
                const configsToSave = currentDevices.map(d => d.toConfig());

                await context.globalState.update('riot-launcher.transferDevices', configsToSave);
                
                await context.workspaceState.update(DEVICE_LIST_CACHE_KEY, configsToSave);
                const activeDevice = devicesTreeItemProvider.getActiveDevice();
                
                await context.workspaceState.update(DEVICE_LIST_CACHE_KEY, configsToSave);
                await context.workspaceState.update(ACTIVE_DEVICE_CACHE_KEY, activeDevice?.toConfig());
				/* Compile commands and configuring IntelliSense */
				const device = (treeItem.getParentDevice() as DesktopDeviceTreeItem).getDevice();
				if(device.board){
					await executeCompileCommandsTask(device);
				}
			}catch (error) {
				vscode.window.showErrorMessage(
					'Error determining RIOT Base Path from Makefile'
				);
				console.error(error);
			}
		}
	});

	context.subscriptions.push(changeApplicationFolderDisposable);

	const createProjectDisposable = vscode.commands.registerCommand('riot-launcher.createProject', async (treeItem : FolderTreeItem) => {
		const appName = await vscode.window.showInputBox({
			title: 'Create RIOT Application',
			prompt: 'Enter the name of your new application',
			placeHolder: 'my_riot_app',
			validateInput: text => {
				return text && text.indexOf(' ') === -1 ? null : 'Application name cannot be empty or contain spaces';
			}
		});
		if(!appName) { return; }
		const appBrief = await vscode.window.showInputBox( {
			title: 'Create RIOT Application',
			prompt: 'Enter a brief description for your application',
			placeHolder: 'An awesome RIOT application'
		});
		if(!appBrief) { return; }
		//optional fields
		const authorName = await vscode.window.showInputBox( {
			title: 'Create RIOT Application',
			prompt: 'Enter author name (optional)',
			placeHolder: 'VS Code User'
		}); if(authorName === undefined) { return; }
		
		const authorEmail = await vscode.window.showInputBox( {
			title: 'Create RIOT Application',
			prompt: 'Enter author email (optional)',
			placeHolder: 'user@example.com'
		}); if(authorEmail === undefined) { return; }
		
		const organization = await vscode.window.showInputBox( {
			title: 'Create RIOT Application',
			prompt: 'Enter organization (optional)',
			placeHolder: 'None'
		}); if(organization === undefined) { return; }
		const licenseOptions = [
			{label: 'MIT'},
			{label: 'LGPL21'},
			{label: 'Apache2'},
			{label: 'BSD'},
			{label: 'None', description: 'Skip license selection'}
		];
		const targetLicense = await vscode.window.showQuickPick(licenseOptions, {
			title: 'Create RIOT Application',
			placeHolder: 'Select a license for your application'
		});
		const licenseValue = targetLicense?.label === 'None' ? '' : targetLicense?.label;
		//end optional fields
		
		const boardOptions = boards.map(board => ({ label: board }));
		const targetBoard = await vscode.window.showQuickPick(boardOptions, {
			title: 'Create RIOT Application',
			placeHolder: 'Select target board for your application'
		});
		if(!targetBoard) { return; }
		const riotBaseUri = await vscode.window.showOpenDialog( {
			title: 'Create RIOT Application',
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select RIOT Base Folder'
		});
		if(!riotBaseUri || riotBaseUri.length === 0) { return; }
		const riotBasePath = riotBaseUri[0].fsPath;
		const targetDirUri = await vscode.window.showOpenDialog( {
			title: 'Create RIOT Application',
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Target Directory for Application'
		});
		if(!targetDirUri || targetDirUri.length === 0) { return; }
		const targetDirPath = targetDirUri[0].fsPath;
		const cfgContent = `[global]
author_name=${authorName}
author_email=${authorEmail}
organization=${organization}
license=${licenseValue}

[application]
name=${appName}
brief=${appBrief}
board=${targetBoard.label}

[user]
name=${authorName}
email=${authorEmail}
organization=${organization}`;
		const tempCfgPath = path.join(targetDirPath, 'temp_cpp.cfg');
		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Creating RIOT Application',
				cancellable: false
			}, async (progress) => {
				progress.report({ message: 'Generating files...'});
				fs.writeFileSync(tempCfgPath, cfgContent, 'utf8');
				console.log(`riotgen application -c ${tempCfgPath} -r ${riotBasePath}`);
				await execAsync(`cd ${targetDirPath} && riotgen application -c ${tempCfgPath} -r ${riotBasePath}`);

				progress.report({ message: 'Running initial make...' });
                await execAsync(`make -C "${targetDirPath}"`);
				await fs.promises.unlink(tempCfgPath);

			});

			const addToView = 'Add to RIOT View';
			const selection = await vscode.window.showInformationMessage(`Successully created RIOT application at ${targetDirPath}`, addToView);
			if(selection === addToView) {
				const newAppUri = vscode.Uri.file(targetDirPath);
				riotFileTreeProvider.addAppFolder(newAppUri);
				const newDevice = new DeviceModel(undefined, targetBoard.label, undefined, newAppUri, riotBaseUri[0]);
				const newDeviceTreeItem = devicesTreeItemProvider.createDeviceTreeItem(newDevice);
				devicesTreeItemProvider.addDevice(newDeviceTreeItem);
				await executeCompileCommandsTask(newDevice);
				devicesTreeItemProvider.refresh();
				try {
					await treeView.reveal(newAppUri, { focus: true, select: true, expand: true});
				}catch (error) {
					console.warn("Could not automatically reveal new application in tree view: ", error);
				}
			}
		}catch (error: any) {
			vscode.window.showErrorMessage(`Failed to create application: ${error.message}`);
			// if (fs.existsSync(tempCfgPath)) {
            //     await fs.promises.unlink(tempCfgPath);
            // }
		}
		context.subscriptions.push(createProjectDisposable);
	});

	const changePortDisposable = vscode.commands.registerCommand('riot-launcher.changePortDevice', async (treeItem : PortTreeItem) => {
		if(!treeItem) {
			vscode.window.showErrorMessage("Please execute this command via RIOT panel.");
			return;
		}
		interface PortPickItem extends vscode.QuickPickItem {
			portpath?: string;
			rawPortInfo?: any;
		}

		const quickPick = vscode.window.createQuickPick<PortPickItem>();
		quickPick.title = 'Device confiuration';
		quickPick.placeholder = 'Select a port...';
		// quickPick.matchOnDetail = true;

		const rawPorts = await SerialPort.list();

		const validPorts = rawPorts.filter(port => port.path.includes('USB') || port.path.includes('COM') || port.path.includes('ACM'));
		
		const items: PortPickItem[] = [{ label: 'None', description: 'No port assigned'}];
		items.push(...validPorts.map(port => {
			const item : PortPickItem = {
				label: port.path,
				description: "Found port",
				portpath: port.path,
				rawPortInfo: port
			};
			return item;
		}));

		items.push({ label: 'Custom...', description: 'Type manually'});
		quickPick.items = items;

		const updateDevice = async (portPath: string, details? : string[]) => {
			(treeItem.getParentDevice() as DesktopDeviceTreeItem).setPortPath(portPath === 'None' ? undefined : portPath);
			let msg = `Changed port of device to: ${portPath}`;
			const device = (treeItem.getParentDevice() as DesktopDeviceTreeItem).getDevice();
			let newDesc = details || [];
			if(device.description) {
				const existingDesc = Array.isArray(device.description) ? device.description : [device.description];
				const memoryInfo = existingDesc.filter((d: string) => d.startsWith('ROM') || d.startsWith('RAM') || d.startsWith('Board'));
				newDesc = [...memoryInfo, ...newDesc];
			}
			device.description = newDesc;
			
			vscode.window.showInformationMessage(msg);
			devicesTreeItemProvider.refresh();
			quickPick.dispose();
		};

		quickPick.onDidTriggerItemButton(async (e) => {
			const item = e.item;
			if(item.portpath) {
				let details : string[] | undefined = undefined;
				if(item.rawPortInfo) {
					details = determineDetails(item.rawPortInfo);
				}
				await updateDevice(item.portpath, details);
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
					value: (treeItem.getParentDevice() as DesktopDeviceTreeItem).getDevice().portPath || ''
				});
				if(customPort) {
					await updateDevice(customPort);
				}
			}else if (selected.label === 'None') {
				await updateDevice('None', undefined);
			} else{
				let details : string[] | undefined = undefined;
				if(selected.rawPortInfo) {
					details = determineDetails(selected.rawPortInfo);
				}
				await updateDevice(selected.portpath ?? 'Error', details);
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
		const oldAppPath = d.getDevice().appPath;
		devicesTreeItemProvider.removeDevice(d);
		devicesTreeItemProvider.refresh();
		cleanupUnusedAppFolder(oldAppPath);
	});
	context.subscriptions.push(forgetDeviceDisposable);

	const setDeviceActiveDisposable = vscode.commands.registerCommand('riot-launcher.setActive', async (d : DesktopDeviceTreeItem) => {
		executeCompileCommandsTask(d.getDevice());
	});
	context.subscriptions.push(setDeviceActiveDisposable);

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
	context.subscriptions.push(changeDescriptionDisposable);

	function cleanupUnusedAppFolder(oldAppPath: vscode.Uri | undefined) {
		if(!oldAppPath) { return; }
		const allDevices = devicesTreeItemProvider.getDeviceModels();
		const isFolderStillUsed = allDevices.some(
			device => device.appPath && device.appPath.fsPath === oldAppPath.fsPath
		);
		if(!isFolderStillUsed) {
			riotFileTreeProvider.removeAppFolder(oldAppPath);
		}
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
		if(device.board?.includes('native')) {
			return;
		}
		try {
			const { stdout } = await execAsync(
				`make info-debug-variable-RAM_LEN BOARD=${device.board}`,
				{ cwd: appFolderPath.fsPath }
			);
			const ramLen = stdout.toString().trim();
			const ramLenDec = ramLen.startsWith('0x') ? parseInt(ramLen, 16) : parseInt(ramLen, 10);
			let romLenDec = ramLen.startsWith('0x') ? parseInt(ramLen, 16) : parseInt(ramLen, 10);
			try {
				const { stdout: romOut } = await execAsync(
					`make info-debug-variable-ROM_LEN BOARD=${device.board}`,
					{ cwd: appFolderPath.fsPath }
				);
				const romOutTrimmed = romOut.toString().trim();
				romLenDec = romOutTrimmed.startsWith('0x') ? parseInt(romOutTrimmed, 16) : parseInt(romOutTrimmed, 10);
			}catch (err) {
				console.log('Error fetching ROM length info: ', err);
			}
			updateDeviceMemoryUi(device as any, {
				boardRam: isNaN(ramLenDec) ? undefined : ramLenDec,
				boardRom: isNaN(romLenDec) ? undefined : romLenDec
			});
		}catch (err) {
			console.log('Error fetching RAM length info: ', err);
		}

		devicesTreeItemProvider.setActiveDevice(device);
		context.workspaceState.update(ACTIVE_DEVICE_CACHE_KEY, device.toConfig());
		riotBaseTreeProvider.refresh(riotBasePath);
		riotBaseTreeView.description = riotBasePath.fsPath;
		riotFileTreeProvider.setActiveAppUri(device.appPath);
		devicesTreeItemProvider.refresh();
	}

	function createProgressBar(used: number, total: number, length: number = 10) : string {
		if(total <= 0) { return `[Unknown]`; }
		const percent = Math.min(100, Math.max(0, (used / total) * 100));
		const filled = Math.round((percent / 100) * length);
		const empty = length - filled;
		return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent.toFixed(1)}%`;
	}

	function updateDeviceMemoryUi(device: any, updates: {appRom?: number, appRam?: number, boardRom?: number, boardRam?: number}) {
		device._memoryState = { ...(device._memoryState || {}), ...updates };
		const mem = device._memoryState;

		const formatMemLine = (type: string, app?: number, board?: number) => {
			const appStr = app !== undefined ? `${app}B` : 'Unknown';
			const boardStr = board !== undefined ? `${board}B` : 'Unknown';
			let bar = '';
			if(app !== undefined && board !== undefined && board > 0) {
				bar = createProgressBar(app, board);
			}
			return `${type}: App ${appStr} / Board ${boardStr} ${bar}`;
		};
		const romLine = formatMemLine('ROM', mem.appRom, mem.boardRom);
		const ramLine = formatMemLine('RAM', mem.appRam, mem.boardRam);

		let desc = device.description || [];
		if(!Array.isArray(desc)) {
			desc = [desc as string];		
		}
		desc = desc.filter((d: string) => !d.startsWith('ROM:') && !d.startsWith('RAM:'));
		desc.push(romLine);
		desc.push(ramLine);
		device.description = desc;
	}

	async function configureCompiledCommands(riotBasePath : string, appFolderPath : string) {	
		const vscodeFolderUri = vscode.Uri.file(path.join(appFolderPath, '.vscode'));
		const cppPropertiesUri = vscode.Uri.joinPath(vscodeFolderUri, 'c_cpp_properties.json');
		const config = vscode.workspace.getConfiguration('C_Cpp', vscode.Uri.file(appFolderPath));

		const compileCommandsPath = path.join(riotBasePath, 'compile_commands.json');

		const currentSetting = config.get<string>('default.compileCommands');

		if(currentSetting !== compileCommandsPath) {
			await config.update(
				'default.compileCommands',
				compileCommandsPath,
				vscode.ConfigurationTarget.Workspace
			);
			vscode.window.showInformationMessage("C/C++ IntelliSense configured");

		}else {
			vscode.window.showInformationMessage("Compiled commands already set");
		}
	}

	async function startDebugging(device: DeviceModel, sessionRecord : ActiveDebugSession) {
		const appPath = device.appPath;
		const boardName = device.board || 'native64';
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
		let appName = path.basename(appPath.fsPath);
		try {
			const { stdout } = await execAsync(
				`make info-debug-variable-APPLICATION`,
				{ cwd: appPath.fsPath}
			);
			const extractedAppName = stdout.toString().trim();
			if(extractedAppName) {
				appName = extractedAppName;
			}
		}catch (err) {
			vscode.window.showErrorMessage(`Error extracting application name from Makefile: ${err}. Using folder name as fallback.`);
		}

		const elfFileName = `${appName}.elf`;
    	const binFolderPath = path.join(appPath.fsPath, 'bin', boardName);
		try {
			if(fs.existsSync(binFolderPath)) {
				const files = await fs.promises.readdir(binFolderPath);
				if(!files.includes(elfFileName)) {
					vscode.window.showErrorMessage(`Compiled ELF file not found in expected location: ${path.join(binFolderPath, elfFileName)}. Please compile the application before debugging.`);			
				}
			}
		} catch (err) {
			vscode.window.showErrorMessage(`Error reading bin folder: ${err}`);
		}

		const absoluteAppPath = appPath.fsPath.replace(/\\/g, '/');
		const programPath = path.join(`${absoluteAppPath}/bin/${boardName}/${elfFileName}`);
		const debugConfigName = `RIOT Debug (${boardName} - Port ${sessionRecord.gdbPort})`;

		
		const launchConfig = {
			name : debugConfigName,
			type : 'cppdbg',
			request : 'launch',
			program : programPath,
			args : [],
			cwd : absoluteAppPath,
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
					text: `target remote localhost:${sessionRecord.gdbPort}`,
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
			try {
				launchConfigs = JSON.parse(launchJsonText);
			}catch (err) {
				vscode.window.showErrorMessage(`Error parsing existing launch.json: ${err}. A new launch.json will be created.`);
				return;
			}
		}	
		let targetConfig = launchConfigs.configurations.find( (c : any) => c.name === debugConfigName);
		
		if(!targetConfig) {
			launchConfigs.configurations.push(launchConfig);
			await fs.promises.writeFile(launchJsonUri.fsPath, JSON.stringify(launchConfigs, null, 2));
			vscode.window.showInformationMessage(`Debug configuration added to ${launchJsonUri.fsPath}`);
			targetConfig = launchConfig;
		}
		const resolveConfig = JSON.parse(JSON.stringify(targetConfig));

		try {
			const success = await vscode.debug.startDebugging(undefined, resolveConfig);
			if(success && vscode.debug.activeDebugSession) {
				sessionRecord.debugSessionId = vscode.debug.activeDebugSession.id;
			}
		}catch (err) {
			vscode.window.showErrorMessage(`Error starting debug session: ${err}`);
		}
	}
}


// This method is called when your extension is deactivated
export function deactivate() {}


		

