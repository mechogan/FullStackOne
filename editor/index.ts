import "./index.css";
import EsbuildInstall from "./views/esbuild";
import api from "./api";
import rpc from "./rpc";
import stackNavigation from "./stack-navigation";
import { BG_COLOR } from "./constants";
import { Projects } from "./views/new/projects";

document.body.classList.add("hover");
window.addEventListener("touchstart", () => {
    document.body.classList.remove("hover");
});

(window as any).onPush["launchURL"] = async (deeplink: string) => {
    // const project = await api.getProjectFromDeepLink(deeplink);
    // projectView.setProject(project);
    // stackNavigation.navigate(await projectView.render(), BG_COLOR);
    // await projectView.runProject();
    // projectsView.renderProjectsList();
};

// pre-init
await api.config.init();
const esbuildInstall = await rpc().esbuild.check();

// start app
const app = async () => {
    // init connectivity
    await api.connectivity.init();

    document.querySelector("#splash").remove();
    stackNavigation.navigate(Projects(), BG_COLOR);

    // for test puposes
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("demo")) {
        const demoProject = (await api.projects.list()).find(
            ({ title }) => title === "Demo"
        );
        if (demoProject) {
            // projectView.setProject(demoProject);
            // stackNavigation.navigate(await projectView.render(), BG_COLOR);
            // await projectView.runProject();
        }
    }
};

// esbuild check before start app
if (!esbuildInstall) {
    EsbuildInstall.onComplete = () => {
        stackNavigation.reset();
        app();
    };
    stackNavigation.navigate(EsbuildInstall.render(), BG_COLOR);
    rpc().esbuild.install();
} else {
    await app();
}

const windows = new Map<string, Window>();
onPush["open"] = (subdomain) => {
    let win = windows.get(subdomain);
    if (!win || win.closed) {
        const url = new URL(window.location.href);
        url.host = subdomain + "." + url.host;
        win = window.open(url.toString(), "_blank");
        windows.set(subdomain, win);
    }
    win.focus();
};
