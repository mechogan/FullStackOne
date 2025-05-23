#include <gtkmm/window.h>
#include <gtkmm/button.h>
#include <iostream>
#include <fstream>
#include "./app.h"
#include "./bin/linux.h"
#include <filesystem>
#include <gtkmm/icontheme.h>
#include <thread>

void printMemory(){
    int pid = getpid();
    std::string filename = "/proc/" + std::to_string(pid) + "/status";
    std::ifstream file(filename);

    if (!file.is_open()) {
        std::cerr << "Error opening file: " << filename << std::endl;
        return;
    }

    std::string line;
    long long vmSizeKb = 0, vmRssKb = 0, vmDataKb = 0;

    while (std::getline(file, line)) {
        if (line.substr(0, 7) == "VmSize:") {
            std::istringstream iss(line.substr(7));
            iss >> vmSizeKb;
        } else if (line.substr(0, 6) == "VmRSS:") {
            std::istringstream iss(line.substr(6));
            iss >> vmRssKb;
        } else if (line.substr(0, 6) == "VmData:") {
           std::istringstream iss(line.substr(6));
           iss >> vmDataKb;
        }
    }

    file.close();

    std::cout << "Process ID: " << pid << std::endl;
    std::cout << "Virtual Memory Size: " << vmSizeKb / 1024.0 << " MB" << std::endl;
    std::cout << "Resident Set Size: " << vmRssKb / 1024.0 << " MB" << std::endl;
    std::cout << "Data Segment Size: " << vmDataKb / 1024.0 << " MB" << std::endl;
}

std::string getExePath()
{
    char result[PATH_MAX];
    ssize_t count = readlink("/proc/self/exe", result, PATH_MAX);
    std::string path = std::string(result, (count > 0) ? count : 0);
    return path;
}

std::string getEditorDir()
{
    std::string path = getExePath();
    int pos = path.find_last_of("/");
    std::string dir = path.substr(0, pos);
    pos = dir.find_last_of("/");
    dir = path.substr(0, pos);
    return dir + "/share/fullstacked/editor";
}

void setDirectories()
{
    std::string home = getenv("HOME");
    std::string root = home + "/FullStacked";
    std::string config = home + "/.config/fullstacked";
    std::string editor = getEditorDir();

    directories(
        root.data(),
        config.data(),
        editor.data());
}

void libCallback(char *projectId, char *type, char *msg)
{
    App::instance->onMessage(projectId, type, msg);
}

void registerDesktopApp()
{
    std::string localIconsDir = std::string(getenv("HOME")) + "/.local/share/icons";
    std::filesystem::create_directories(localIconsDir);
    std::string appIconFile = getEditorDir() + "/assets/dev-icon.png";
    std::filesystem::copy_file(appIconFile, localIconsDir + "/fullstacked.png", std::filesystem::copy_options::overwrite_existing);

    std::string localAppsDir = std::string(getenv("HOME")) + "/.local/share/applications";
    std::filesystem::create_directories(localAppsDir);
    std::ofstream localAppFile(localAppsDir + "/fullstacked.desktop");
    std::string contents =
        "[Desktop Entry]\n"
        "Name=FullStacked\n"
        "Exec=" +
        getExePath() + " %u\n"
                       "Terminal=false\n"
                       "Type=Application\n"
                       "MimeType=x-scheme-handler/fullstacked\n"
                       "Icon=fullstacked\n"
                       "Categories=Development;Utility;";
    localAppFile << contents.c_str();
    localAppFile.close();

    system(("update-desktop-database " + localAppsDir).c_str());
}

int main(int argc, char *argv[])
{
    registerDesktopApp();
    setDirectories();
    callback((void *)libCallback);
    auto app = new App();

    std::string httpPrefix = "http";
    std::string kioskFlag = "--kiosk";
    std::string startupId = "";
    for(int i = 1; i < argc; i++) {
        std::string arg(argv[i]);

        if(arg.compare(0, httpPrefix.size(), httpPrefix) == 0) {
            app->deeplink = arg;
        } else if(arg == kioskFlag) {
            app->kiosk = true;
            if(argc > i + 1) {
                startupId = std::string(argv[i + 1]);
                i++;
            }
        }
    }

    // auto exec_run = [](){ while (true) {
    //     printMemory();
    //     std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    // } };
    // std::thread t(exec_run);
    
    return app->run(startupId);
}