#include <gtkmm/window.h>
#include <gtkmm/button.h>
#include <iostream>
#include "./app.h"
#include "./bin/linux-x86_64.h"

std::string getexedir()
{
    char result[PATH_MAX];
    ssize_t count = readlink("/proc/self/exe", result, PATH_MAX);
    std::string path = std::string(result, (count > 0) ? count : 0);
    std::size_t pos = path.find_last_of("/");
    return path.substr(0, pos);
}

void setDirectories()
{
    std::string home = getenv("HOME");
    std::string root = home + "/FullStacked";
    std::string config = home + "/.config/fullstacked";
    std::string editor = getexedir() + "/editor";

    directories(
        root.data(),
        config.data(),
        editor.data());
}

void libCallback(char *projectId, char *type, char *msg)
{
    App::instance->onMessage(projectId, type, msg);
}

int main(int argc, char *argv[])
{
    setDirectories();
    callback((void *)libCallback);
    auto app = new App();
    return app->run();
}