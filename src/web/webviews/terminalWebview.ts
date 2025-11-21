import {type TabStates, type RiotTerminalState} from "../providers/terminalProvider";

declare var acquireVsCodeApi: any;
let vscode: any;
let tabs: HTMLDivElement;
let tabContent: HTMLDivElement;
let terminal: HTMLTextAreaElement;
let input: HTMLInputElement;
let tabStates: TabStates;
let selectedTab: string | undefined;
let bodyShown: boolean = false;
let scrollButtonLeft: HTMLDivElement;
let scrollButtonRight: HTMLDivElement;

window.onload = () => {
    document.body.innerHTML = `
    <div id="tabContent">
        <div class="inputArea">
            <button class="submitButton" onclick="sendInput()">Submit</button>
            <input type="text" placeholder="Input" id="input" oninput="updateInput()"/>
        </div>
        <textarea id="terminal" readonly></textarea>
        <div id="terminalSelection">
            <p>Select an Action for the Device:</p>
            <button onclick="requestUpdateTerminalState('flash')">Flash</button>
            <button onclick="requestUpdateTerminalState('communication')">Communication</button>
        </div>
        <button onclick="requestUpdateTerminalState('none')">X</button>
    </div>
    <div id="tabSelection" class="tabSelection">
        <div class="scrollButton" id="scrollButtonLeft">
            <button onclick="scrollTabs(true)"><</button>
        </div>
        <div id="tabs" class="tabs"></div>
        <div class="scrollButton" id="scrollButtonRight">
            <button onclick="scrollTabs(false)">></button>
        </div>
    </div>
    <p id="noSelection">No Tabs open</p>
    `;
    vscode = acquireVsCodeApi();
    tabs = document.getElementById("tabs") as HTMLDivElement;
    tabContent = document.getElementById("tabContent") as HTMLDivElement;
    terminal = document.getElementById("terminal") as HTMLTextAreaElement;
    input = document.getElementById("input") as HTMLInputElement;
    scrollButtonLeft = document.getElementById('scrollButtonLeft') as HTMLDivElement;
    scrollButtonRight = document.getElementById('scrollButtonRight') as HTMLDivElement;
    vscode.postMessage({
        action: 'requestState'
    });
};

window.addEventListener("message", (event) => {
    switch (event.data.action) {
        case "clearTerminal":
            if (!selectedTab) {
                return;
            }
            tabStates[selectedTab].terminalData = '';
            terminal.value = '';
            break;
        case "message":
            tabStates[event.data.uuid].terminalData += event.data.message;
            if (selectedTab === event.data.uuid) {
                const scrollDown = terminal.scrollTop === (terminal.scrollHeight - terminal.clientHeight);
                terminal.value += event.data.message;
                if (scrollDown) {
                    terminal.scrollTop = terminal.scrollHeight;
                }
            }
            break;
        case "openTab":
            createTab(event.data.uuid, event.data.label, false, true);
            break;
        case "selectTab":
            selectTab(event.data.uuid);
            break;
        case "updateTerminalState":
            updateTerminalState(event.data.newTerminalState);
            break;
        case "closeTab":
            closeTab(event.data.uuid);
            break;
        case "setState":
            tabStates = event.data.state.tabStates;
            selectedTab = event.data.state.selectedTab;
            if (Object.keys(tabStates).length !== 0) {
                initialize();
            }
            break;
    }
});

function scrollTabs(toLeft: boolean) {
    tabs.scrollLeft += 100 * (toLeft ? -1 : 1);
    updateScrollButtons();
}

function updateScrollButtons() {
    if (tabs.clientWidth >= tabs.scrollWidth) {
        scrollButtonLeft.className = "scrollButton";
        scrollButtonRight.className = "scrollButton";
    } else {
        scrollButtonLeft.className = "scrollButton active";
        scrollButtonRight.className = "scrollButton active";
    }
}

window.addEventListener('resize', () => {
    if (selectedTab) {
        updateScrollButtons();
    }
});

function updateBody(show: boolean) {
    if (bodyShown !== show) {
        document.body.className = show ? 'shown' : 'none';
        bodyShown = show;
    }
}

function initialize() {
    document.body.className = "shown";
    for (const [uuid, state] of Object.entries(tabStates)) {
        createTab(uuid, state.label, uuid === selectedTab, false);
    }
}

function createTab(uuid: string, label: string, setFocus: boolean, newTabState: boolean) {
    updateBody(true);
    tabs.insertAdjacentHTML("beforeend", `
        <div id="${uuid}" class="tab" onclick="selectTab('${uuid}')">
            <p>${label}</p>
            <a class="closeButton" onclick="event.stopPropagation(); requestCloseTab('${uuid}')">X</a>
        </div>
    `);
    if (newTabState) {
        tabStates[uuid] = {
            label: label,
            terminalState: 'none',
            terminalData: '',
            inputData: '',
        };
    }
    if (setFocus) {
        selectTab(uuid);
    }
    updateScrollButtons();
}

function selectTab(uuid: string | undefined) {
    if (!uuid) {
        selectedTab = undefined;
        updateBody(false);
        return;
    }
    if (selectedTab !== undefined) {
        (document.getElementById(selectedTab) as HTMLDivElement).className = 'tab';
    }
    (document.getElementById(uuid) as HTMLDivElement).className = 'tab selected';
    selectedTab = uuid;
    tabContent.className = tabStates[selectedTab].terminalState;
    terminal.value = tabStates[selectedTab].terminalData;
    terminal.scrollTop = terminal.scrollHeight;
    input.value = tabStates[selectedTab].inputData;
    vscode.postMessage({
        action: 'selectTab',
        selectedTab: selectedTab
    });
}

function requestCloseTab(uuid: string) {
    vscode.postMessage({
        action: 'requestCloseTab',
        uuid: uuid
    });
}

function closeTab(uuid: string) {
    document.getElementById(uuid)?.remove();
    delete tabStates[uuid];
}

function requestUpdateTerminalState(newTerminalState: RiotTerminalState) {
    vscode.postMessage({
        action: 'requestUpdateTerminalState',
        newTerminalState: newTerminalState
    });
}

function updateTerminalState(newTerminalState: RiotTerminalState) {
    if (!selectedTab) {
        return;
    }
    tabContent.className = newTerminalState;
    tabStates[selectedTab].terminalState = newTerminalState;
    tabStates[selectedTab].terminalData = '';
    tabStates[selectedTab].inputData = '';
    terminal.value = '';
    input.value = '';
}

function updateInput(): void {
    if (!selectedTab) {
        return;
    }
    tabStates[selectedTab].inputData = input.value;
    vscode.postMessage({
        action: 'updateInput',
        inputData: input.value
    });
}

function sendInput(): void {
    vscode.postMessage({
        action: 'sendInput'
    });
}

//Fix, because some compiler (either tsc oder esbuild, i dont know) doesn't include unused functions and it doesnt
//realize its used in the html strings

//@ts-ignore
window.requestCloseTab = requestCloseTab;
//@ts-ignore
window.scrollTabs = scrollTabs;
//@ts-ignore
window.sendInput = sendInput;
//@ts-ignore
window.updateInput = updateInput;
//@ts-ignore
window.requestUpdateTerminalState = requestUpdateTerminalState;