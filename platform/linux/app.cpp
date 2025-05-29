#include "./app.h"
#include <iostream>

App::App()
{
    App::instance = this;
    gui->createApp();
}

void App::onMessage(char *projectId, char *type, char *message)
{
    auto exists = activeWindows.find(projectId);
    if (exists != activeWindows.end())
    {
        exists->second.second->onMessage(type, message);
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
    auto exists = activeWindows.find(projectId);
    if (exists != windows.end())
    {
        exists->second->show();
        exists->second->present();
        exists->second->fullscreen();
        webkit_web_view_reload(exists->second->webview);
    }
    else
    {
        Instance *instance = new Instance(projectId, isEditor);
        Window *window = gui->createWindow();

        windows[projectId] = std::pair(instance, window);
        if(kiosk) {
            window->setFullscreen();
        }
    }
}

int App::run(std::string startupId)
{
   
    app->signal_startup().connect([&]{ open(startupId, startupId == ""); });
    return app->run();
}