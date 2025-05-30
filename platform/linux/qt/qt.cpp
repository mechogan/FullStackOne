#include "./qt.h"
#include <iostream>

int QtGUI::run(int &argc, char **argv, std::function<void()> onReady)
{
    app = new QApplication(argc, argv);
    onReady();
    return app->exec();
}

Window *QtGUI::createWindow(std::function<Response(std::string)> onRequest,
                            std::function<std::string(std::string)> onBridge)
{
    QtWindow *window = new QtWindow();
    window->onRequest = onRequest;
    window->onBridge = onBridge;
    return window;
}

QtWindow::QtWindow()
{
    windowQt = new QMainWindow;
    windowQt->show();
    windowQt->resize(600, 400);
    webEngineView = new QWebEngineView(windowQt);
    QUrl url = QUrl::fromUserInput("https://fullstacked.org");
    webEngineView->load(url);
    windowQt->setCentralWidget(webEngineView);
}

void QtWindow::onMessage(std::string type, std::string message)
{
}

void QtWindow::close() {}

void QtWindow::bringToFront(bool reload) {}

void QtWindow::setFullscreen() {}