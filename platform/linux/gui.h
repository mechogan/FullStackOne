#ifndef GUI_H_
#define GUI_H_

#include <string>

class Window
{
public:
    virtual void onMessage(std::string type, std::string message);

    virtual void close();

    virtual void setFullscreen();
};

class GUI
{
public:
    virtual void createApp();

    virtual Window* createWindow();
};



#endif