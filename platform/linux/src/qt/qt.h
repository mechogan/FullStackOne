#ifndef Qt_H_
#define Qt_H_

#include "../gui.h"
#include <QApplication>
#include <QMainWindow>
#include <QWebEngineUrlRequestJob>
#include <QWebEngineUrlScheme>
#include <QWebEngineUrlSchemeHandler>
#include <QWebEngineView>
#include <string>

class Bridge;

class QtWindow : public Window {
    private:
        QMainWindow *windowQt;
        QWebEngineView *webEngineView;
        Bridge *bridge;

    public:
        QtWindow();

        void onMessage(std::string type, std::string message);

        void close();

        void bringToFront(bool reload);

        void setFullscreen();

        void setTitle(std::string stitle);
};

class Bridge : public QObject {
        Q_OBJECT
    public:
        QtWindow *window;

    public slots:
        QString call(const QString &message);
    signals:
        void core_message(const QString &type, const QString &message);
};

class SchemeHandler : public QWebEngineUrlSchemeHandler {
    public:
        static SchemeHandler *singleton;
        std::map<std::string, QtWindow *> activeHosts;
        SchemeHandler(QObject *parent = nullptr);
        void requestStarted(QWebEngineUrlRequestJob *job);
};

class QtGUI : public GUI {
    public:
        int run(int &argc, char **argv, std::function<void()> onReady);

        Window *createWindow(std::function<Response(std::string)> onRequest,
                             std::function<std::string(std::string)> onBridge);

    private:
        QApplication *app;
};

#endif