#include "./app.h"

App::App()
{
    App::instance = this;
    app = Gtk::Application::create();
}

void App::onMessage(char *projectId, char *type, char *message)
{
    auto exists = windows.find(projectId);
    if (exists != windows.end())
    {
        exists->second->onMessage(type, message);
    }
}

void App::open(std::string projectId, bool isEditor)
{
    auto exists = windows.find(projectId);
    if (exists != windows.end())
    {
        exists->second->show();
        webkit_web_view_reload(exists->second->webview);
    }
    else
    {
        auto win = new Instance(projectId, isEditor);
        windows[projectId] = win;
        app->add_window(*win);
    }
}

int App::run()
{
    app->signal_startup().connect([&]
                                  { open("", true); });
    return app->run();
}