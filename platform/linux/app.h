#ifndef APP_H
#define APP_H

#include "./instance.h"
#include <map>
#include "./gtk/gtk.h"


class App
{
private:
    GUI *gui = new WebkitGTKGUI();

public:
    inline static App *instance;
    std::map<std::string, Instance*> activeWindows;
    std::string deeplink;
    bool kiosk = false;

    App();

    void onMessage(char *projectId, char* type, char* message);

    void open(std::string projectId, bool isEditor);

    int run(std::string startupId);
};

#endif