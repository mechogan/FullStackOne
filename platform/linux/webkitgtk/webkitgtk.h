#ifndef WebkitGTKGUI_H_
#define WebkitGTKGUI_H_

#include "../gui.h"
#include <string>
#include <gtkmm/application.h>

class WebkitGTKWindow : public Window
{
public:
    void onMessage(std::string type, std::string message);
    void close();

    Gtk::Window* windowGTK;
};

class WebkitGTKGUI : public GUI 
{
public:
    void createApp();
    
    Window* createWindow();

private:
    Glib::RefPtr<Gtk::Application> app;
};



#endif