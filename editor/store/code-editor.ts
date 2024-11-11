import { createSubscribable } from "."

let sidePanelClosed = false;
const sidePanel = createSubscribable(() => sidePanelClosed)

export const codeEditor = {
    sidePanelClosed: sidePanel.subscription,
    setSidePanelClosed
}

function setSidePanelClosed(closed: boolean){
    sidePanelClosed = closed;
    sidePanel.notify()
}