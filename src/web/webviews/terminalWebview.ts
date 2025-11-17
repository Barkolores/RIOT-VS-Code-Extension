import {RiotTerminalState} from "../providers/terminalProvider";

declare var acquireVsCodeApi: any;
let vscode: any;
let tabs: HTMLDivElement;
let tabContent: HTMLDivElement;
let terminal: HTMLTextAreaElement;
let input: HTMLInputElement;
let currentState: any;

window.onload = () => {
    document.body.innerHTML = `
    <div id="tabContent">
        <div class="inputArea">
            <button class="submitButton" onclick="sendInput()">Submit</button>
            <input type="text" placeholder="Input" id="input" oninput="updateInput()"/>
        </div>
        <textarea id="terminal" readonly></textarea>
    </div>
    <div id="tabs" class="tabs"></div>
    <p class="noSelection">No Device open</p>
    `;
    vscode = acquireVsCodeApi();
    tabs = document.getElementById("tabs") as HTMLDivElement;
    tabContent = document.getElementById("tabContent") as HTMLDivElement;
    terminal = document.getElementById("terminal") as HTMLTextAreaElement;
    input = document.getElementById("input") as HTMLInputElement;
    const script = document.getElementById("script") as HTMLScriptElement;
    currentState = JSON.parse(script.dataset.json ? script.dataset.json : '{}');
    if (currentState.devices.length !== 0) {
        initialize();
    }
};

window.addEventListener("message", (event) => {
    console.log(event.data.action);
    switch (event.data.action) {
        case "clearTerminal":
            for (const device of currentState.devices) {
                if (device.uuid === currentState.selectedTab) {
                    device.terminalData = '';
                    break;
                }
            }
            terminal.value = '';
            break;
        case "message":
            for (const device of currentState.devices) {
                if (device.uuid === event.data.uuid) {
                    device.terminalData += event.data.message;
                    break;
                }
            }
            if (currentState.selectedTab === event.data.uuid) {
                const scrollDown = terminal.scrollTop === (terminal.scrollHeight - terminal.clientHeight);
                terminal.value += event.data.message;
                if (scrollDown) {
                    terminal.scrollTop = terminal.scrollHeight;
                }
            }
            break;
        case "addDevice":
            if (currentState.devices.length === 0) {
                document.body.className = "shown";
            }
            currentState.devices.push({
                uuid: event.data.uuid as string,
                label: event.data.label as string,
                terminalState: event.data.terminalState as RiotTerminalState,
                terminalData: event.data.terminalData as string,
                inputData: event.data.inputData as string,
            });
            if (currentState.selectedTab) {
                (document.getElementById(currentState.selectedTab) as HTMLButtonElement).className = "tab";
            }
            createTab(event.data.uuid, event.data.label, true);
            tabContent.className = event.data.terminalState;
            break;
        case "removeDevice":
            for (let i = 0; i < currentState.devices.length; i++) {
                if (currentState.devices[i].uuid === event.data.uuid) {
                    currentState.devices.splice(i, 1);
                    if (currentState.selectedTab === event.data.uuid) {
                        if (currentState.devices.length === 0) {
                            currentState.selectedTab = '';
                        } else {
                            selectTab(currentState.devices[0]);
                        }
                        (document.getElementById(event.data.uuid) as HTMLButtonElement).remove();
                    }
                    break;
                }
            }
            if (currentState.devices.length === 0) {
                document.body.className = "none";
            }
            break;
        case "updateDevice":
            for (let i = 0; i < currentState.devices.length; i++) {
                if (currentState.devices[i].uuid === event.data.uuid) {
                    currentState.devices[i] = new Object({
                        ...currentState.devices[i],
                        terminalState: event.data.terminalState,
                        terminalData: "",
                        inputData: "",
                    });
                    break;
                }
            }
            if (currentState.selectedTab === event.data.uuid) {
                terminal.value = '';
                input.value = '';
                tabContent.className = event.data.terminalState;
            }
    }
});

function initialize() {
    document.body.className = "shown";
    let j = undefined;
    for (let i = 0; i < currentState.devices.length; i++) {
        const selected = currentState.devices[i].uuid === currentState.selectedTab;
        createTab(currentState.devices[i].uuid, currentState.devices[i].label, selected);
        if (selected) {
            j = i;
        }
    }
    if (j !== undefined) {
        terminal.value = currentState.devices[j].terminalData;
        input.value = currentState.devices[j].inputData;
        tabContent.className = currentState.devices[j].terminalState;
    }
}

function createTab(uuid: string, label: string, setFocus: boolean) {
    const tab = document.createElement("button");
    tab.className = "tab" + (setFocus ? " selected" : "");
    tab.id = uuid;
    tab.innerText = label;
    tab.onclick = () => selectTab(tab);
    if (setFocus) {
        currentState.selectedTab = tab.id;
        vscode.postMessage({
            action: "selectTab",
            tab: tab.id
        });
    }
    tabs.appendChild(tab);
}

function selectTab(tab: HTMLButtonElement) {
    if (currentState.selectedTab === tab.id) {
        return;
    }
    (document.getElementById(currentState.selectedTab) as HTMLButtonElement).className = "tab";
    tab.className = "tab selected";
    currentState.selectedTab = tab.id;
    vscode.postMessage({
        action: "selectTab",
        tab: tab.id
    });
    for (const device of currentState.devices) {
        if (device.uuid === tab.id) {
            terminal.value = device.terminalData;
            input.value = device.inputData;
            tabContent.className = device.terminalState;
            break;
        }
    }
}

function updateInput(): void {
    for (const device of currentState.devices) {
        if (device.uuid === currentState.selectedTab) {
            device.inputData = input.value;
            break;
        }
    }
    vscode.postMessage({
        action: 'updateInput',
        uuid: currentState.selectedTab,
        input: input.value
    });
}

function sendInput(): void {
    let uuid = undefined;
    let message = '';
    for (const device of currentState.devices) {
        if (device.uuid === currentState.selectedTab) {
            uuid = device.uuid;
            message = device.inputData;
            break;
        }
    }
    if (!uuid) {
        return;
    }
    vscode.postMessage({
        action: 'message',
        uuid: uuid,
        message: message,
    });
}

//fix because unused functions (not seen in html string) don't get compiled
//@ts-ignore
global.sendInput = sendInput;
//@ts-ignore
global.updateInput = updateInput;