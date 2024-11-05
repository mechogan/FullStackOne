import api from "./api";
import rpc from "./rpc";
import stackNavigation from "./stack-navigation";
import { BG_COLOR } from "./constants";
import { Projects } from "./views/projects";
import { ImportZip } from "./views/add-project/import-zip";
import { Project } from "./views/project";
import { CloneGit } from "./views/add-project/clone-git";
import { Project as ProjectType } from "./api/config/types";
import { esbuildInstall } from "./views/esbuild";
import { ipcEditor } from "./ipc";

const esbuildVersion = await ipcEditor.esbuild.version();
console.log(esbuildVersion);

// // fix windows scrollbars
// if (navigator.userAgent.includes("Windows")) {
//     const link = document.createElement("link");
//     link.rel = "stylesheet";
//     link.href = "/scrollbars.css";
//     document.head.append(link);
// }

// globalThis.onPush["launchURL"] = async (deeplink: string) => {
//     const repo = api.deeplink.getRepo(deeplink);
//     if (!repo) return;

//     const launchProject = async (project: ProjectType) => {
//         if (repo.branch) {
//             await api.git.checkout(project, repo.branch);
//         }
//         stackNavigation.navigate(
//             Project({
//                 project,
//                 run: true,
//                 didUpdateProject: projects.reloadProjectsList
//             }),
//             BG_COLOR
//         );
//     };

//     const project = await api.deeplink.findExistingProjectWithRepoUrl(repo.url);
//     if (project) {
//         return launchProject(project);
//     }

//     stackNavigation.navigate(
//         CloneGit({
//             didCloneProject: (project) => {
//                 projects.reloadProjectsList();
//                 stackNavigation.back();
//                 launchProject(project);
//             },
//             repoUrl: repo.url
//         }),
//         BG_COLOR
//     );
// };

// // check for new install
// const installDemo = await api.config.init();

// document.querySelector("#splash").remove();
// const projects = Projects();
// stackNavigation.navigate(projects.container, BG_COLOR);

// const esbuildIsInstalled = await rpc().esbuild.check();
// if (!esbuildIsInstalled) {
//     await esbuildInstall();
// }

// if (installDemo) {
//     const name = "Demo.zip";
//     const data = (await rpc().fs.readFile(name)) as Uint8Array;
//     stackNavigation.navigate(
//         ImportZip({
//             didImportProject: () => {
//                 projects.reloadProjectsList();
//                 stackNavigation.back();

//                 // webcontainer test
//                 testDemo();
//             },
//             zip: {
//                 data,
//                 name
//             }
//         }),
//         BG_COLOR
//     );
// }

// // init connectivity
// await api.connectivity.init();

// // for webcontainer test purposes
// async function testDemo() {
//     const searchParams = new URLSearchParams(window.location.search);
//     if (searchParams.has("demo")) {
//         const demoProject = (await api.projects.list()).find(
//             ({ title }) => title === "Demo"
//         );
//         if (demoProject) {
//             stackNavigation.navigate(
//                 Project({
//                     project: demoProject,
//                     didUpdateProject: null,
//                     run: true
//                 }),
//                 BG_COLOR
//             );
//         }
//     }
// }

// const windows = new Map<string, Window>();
// onPush["open"] = (subdomain) => {
//     let win = windows.get(subdomain);
//     if (!win || win.closed) {
//         const url = new URL(window.location.href);
//         url.host = subdomain + "." + url.host;
//         win = window.open(url.toString(), "_blank");
//         windows.set(subdomain, win);
//     }
//     win.focus();
// };
