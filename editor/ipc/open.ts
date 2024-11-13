export function open(projectId: string) {
    const url = new URL(window.location.href);
    url.pathname = "/open";
    url.searchParams.set("id", projectId);
    fetch(url.toString());
}