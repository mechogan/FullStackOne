#include "./app.h"
#include <iostream>

App::App()
{
    App::instance = this;
    app = Gtk::Application::create("org.fullstacked");
}

void App::onMessage(char *projectId, char *type, char *message)
{
    auto exists = windows.find(projectId);
    if (exists != windows.end())
    {
        exists->second->onMessage(type, message);
    }
}

void App::onClose(GtkWidget *widget, gpointer user_data)
{
    auto i = static_cast<Instance *>(user_data);
    App::instance->windows.erase(i->id);
    delete i;
};

void App::open(std::string projectId, bool isEditor)
{
    auto exists = windows.find(projectId);
    if (exists != windows.end())
    {
        exists->second->show();
        exists->second->present();
        exists->second->fullscreen();
        webkit_web_view_reload(exists->second->webview);
    }
    else
    {
        auto win = new Instance(projectId, isEditor);
        windows[projectId] = win;
        if(kiosk) {
            win->signal_realize().connect([&]{ 
                win->fullscreen();
            });
        }
        win->show();
        app->add_window(*win);
    }
}

int App::run(std::string startupId)
{
    WebKitMemoryPressureSettings *mp = webkit_memory_pressure_settings_new();
    webkit_memory_pressure_settings_set_memory_limit(mp, 200);
    webkit_network_session_set_memory_pressure_settings(mp);
    app->signal_startup().connect([&]{ open(startupId, startupId == ""); });
    return app->run();
}