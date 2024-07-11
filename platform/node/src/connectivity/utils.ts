import os from "os";
import child_process from "child_process";

export function getNetworkInterfacesInfo(ipv4Only = false) {
    const networkInterfaces = os.networkInterfaces();

    const interfaces = [
        "en",
        "eth",
        "wlan",
        "WiFi",
        "Wi-Fi",
        "Ethernet",
        "wlp"
    ];

    return Object.entries(networkInterfaces)
        .filter(([netInterface, _]) =>
            interfaces.find((prefix) => netInterface.startsWith(prefix))
        )
        .map(([netInterface, infos]) => ({
            name: netInterface,
            addresses:
                infos
                    ?.filter((iface) =>
                        ipv4Only ? iface.family === "IPv4" : true
                    )
                    .map(({ address }) => address) ?? []
        }));
}

export function getComputerName() {
    switch (process.platform) {
        case "win32":
            return process.env.COMPUTERNAME;
        case "darwin":
            return child_process
                .execSync("scutil --get ComputerName")
                .toString()
                .trim();
        default:
            return os.hostname();
    }
}
