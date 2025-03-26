import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import stackNavigation from "../../stack-navigation";
import { BG_COLOR, SETTINGS_VIEW_ID } from "../../constants";
import { Version } from "./version";
import { GitAuthentications } from "./git-authentications";
import { createElement } from "../../components/element";
import { Store } from "../../store";
import { InputSwitch } from "@fullstacked/ui";
import { codeEditor } from "../../code-editor";

export function Settings() {
    const { container, scrollable } = ViewScrollable();
    container.id = SETTINGS_VIEW_ID;
    container.classList.add("view");

    const topBar = TopBar({
        title: "Settings"
    });

    container.prepend(topBar);

    const userMode = UserMode();

    scrollable.append(
        userMode, 
        AgentProvider(),
        GitAuthentications(), 
        Version());

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: userMode.destroy
    });
}

function UserMode() {
    const container = createElement("div");
    container.classList.add("user-mode");

    const top = document.createElement("div");
    top.innerHTML = `<h2>User Mode</h2>`;

    const inputSwitch = InputSwitch();
    top.append(inputSwitch.container);

    const p = document.createElement("p");
    p.innerText = `Simpler interface, removes all developer-related elements.
Projects start faster, builds only when needed.`;

    container.append(top, p);

    const cb = (userMode: boolean) => {
        inputSwitch.input.checked = userMode;
    };
    Store.preferences.isUserMode.subscribe(cb);
    container.ondestroy = () => {
        Store.preferences.isUserMode.unsubscribe(cb);
    };
    inputSwitch.input.onchange = () => {
        Store.preferences.setUserMode(inputSwitch.input.checked);
    };

    return container;
}

function AgentProvider() {
    const container = document.createElement("div");
    container.classList.add("agent-provider-config");
    container.innerHTML = `<h2>Configure Agent Providers</h2>`;

    container.append(codeEditor.agentConfigurator);

    return container;
}
