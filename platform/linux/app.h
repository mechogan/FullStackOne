#ifndef APP_H
#define APP_H

#include <gtkmm/application.h>
#include "./instance.h"

class App
{
private:
    Glib::RefPtr<Gtk::Application> app;

public:
    inline static App *instance;
    std::map<std::string, Instance *> windows;
    std::string deeplink;
    bool kiosk = false;

    App();

    void onMessage(char *projectId, char* type, char* message);

    void open(std::string projectId, bool isEditor);

    static void onClose(GtkWidget* widget, gpointer user_data);

    int run(std::string startupId);
};

#endif