#ifndef Qt_H_
#define Qt_H_

#include "../gui.h"
#include <string>
#include <QApplication>
#include <QMainWindow>
#include <QWebEngineView>
#include <QWebEngineUrlScheme>
#include <QWebEngineUrlSchemeHandler>
#include <QWebEngineUrlRequestJob>

class QtWindow : public Window
{
private:
    QMainWindow *windowQt;
    QWebEngineView *webEngineView;

public:
    QtWindow();

    void onMessage(std::string type, std::string message);

    void close();

    void bringToFront(bool reload);

    void setFullscreen();
};

class SchemeHandler : public QWebEngineUrlSchemeHandler
{
public:
    static SchemeHandler* singleton;
    std::map<std::string, QtWindow*> activeHosts;
    SchemeHandler(QObject *parent = nullptr);
    void requestStarted(QWebEngineUrlRequestJob *job);
};


class QtGUI : public GUI
{
public:
    int run(int &argc, char **argv, std::function<void()> onReady);

    Window *createWindow(std::function<Response(std::string)> onRequest,
                         std::function<std::string(std::string)> onBridge);
private:
    QApplication * app;
};

#endif