import api from "../../api";
import { Button } from "../../components/primitives/button";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";

export function Peers() {
    const { container, scrollable } = ViewScrollable();
    container.id = "peers";
    container.classList.add("view");

    const connectionButton = Button({
        style: "icon-large",
        iconLeft: "Link"
    });

    const topBar = TopBar({
        title: "Peers",
        actions: [connectionButton]
    });

    container.prepend(topBar);

    const lists = document.createElement("div");
    lists.classList.add("peers-lists");

    lists.append(Connected(), Nearby(), Trusted());
    scrollable.append(lists);

    return container;
}

function Connected() {
    const container = document.createElement("div");

    const title = document.createElement("h3");
    title.innerText = "Connected";

    const count = document.createElement("span");
    title.append(" (", count, ")");
    count.innerText = "0";

    container.append(title);

    return container;
}

function Nearby() {
    const container = document.createElement("div");

    const title = document.createElement("h3");
    title.innerText = "Nearby";

    const count = document.createElement("span");
    title.append(" (", count, ")");
    count.innerText = "0";

    container.append(title);

    return container;
}

function Trusted() {
    const container = document.createElement("div");

    const title = document.createElement("h3");
    title.innerText = "Trusted";

    const count = document.createElement("span");
    title.append(" (", count, ")");
    count.innerText = "0";

    container.append(title);

    const list = document.createElement("ul");
    container.append(list);

    api.connectivity.peers.trusted().then((peersTrusted) => {
        count.innerText = peersTrusted.length.toString();

        peersTrusted.forEach((peer) => {
            const item = document.createElement("li");

            item.innerText = peer.name;

            const forgetButton = Button({
                text: "Forget",
                color: "red"
            });

            item.append(forgetButton);

            list.append(item);
        });
    });

    return container;
}
