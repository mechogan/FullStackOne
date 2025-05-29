#ifndef APP_H
#define APP_H

#include "./instance.h"
#include "gui.h"


class App
{
private:
    GUI *gui = new GUI();

public:
    inline static App *instance;
    std::map<std::string, std::pair<Instance*, Window*>> activeWindows;
    std::string deeplink;
    bool kiosk = false;

    App();

    void onMessage(char *projectId, char* type, char* message);

    void open(std::string projectId, bool isEditor);

    static void onClose(GtkWidget* widget, gpointer user_data);

    int run(std::string startupId);
};

#endif