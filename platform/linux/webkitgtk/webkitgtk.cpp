#include "./webkitgtk.h"
#include "webkitgtk.h"

#include <webkit/webkit.h>

void WebkitGTKGUI::createApp()
{
    app = Gtk::Application::create("org.fullstacked");
    WebKitMemoryPressureSettings *mp = webkit_memory_pressure_settings_new();
    webkit_memory_pressure_settings_set_memory_limit(mp, 200);
    webkit_network_session_set_memory_pressure_settings(mp);
}

Window* WebkitGTKGUI::createWindow()
{
    WebkitGTKWindow *window = new WebkitGTKWindow();
    app->add_window(*window->windowGTK);
    return window;
}

WebkitGTKWindow::WebkitGTKWindow(){
    windowGTK = new Gtk::Window();
    windowGTK->set_default_size(800, 600);
    windowGTK->show();
}

void WebkitGTKWindow::onMessage(std::string type, std::string message)
{

}

void WebkitGTKWindow::close()
{

}