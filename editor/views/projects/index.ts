import { Button } from "../../components/primitives/button";
import { ViewScrollable } from "../../components/view-scrollable";
import {
    BG_COLOR,
    PROJECTS_TITLE,
    PROJECTS_VIEW_ID,
    SETTINGS_BUTTON_ID
} from "../../constants";
import stackNavigation from "../../stack-navigation";
import { List } from "./list";
import { SearchAdd } from "./search-add";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { PeersWidget } from "./peers-widget";
import { Settings } from "../settings";

export function Projects() {
    const { container, scrollable } = ViewScrollable();
    container.id = PROJECTS_VIEW_ID;

    const topBar = TopBar();
    container.prepend(topBar);

    const list = List();

    scrollable.append(SearchAdd(), list);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            topBar.destroy();
            list.destroy();
        }
    });
}

function TopBar() {
    const settings = Button({
        style: "icon-large",
        iconLeft: "Settings"
    });
    settings.id = SETTINGS_BUTTON_ID;
    settings.onclick = Settings

    const peersWidget = PeersWidget();

    const topBar = TopBarComponent({
        noBack: true,
        title: PROJECTS_TITLE,
        actions: [peersWidget, settings]
    });

    topBar.ondestroy = peersWidget.destroy;

    return topBar;
}
