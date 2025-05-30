#include "./qt.h"
#include <iostream>

#include <QWebEngineProfile>
#include <QBuffer>
#include <map>
#include "../utils.h"

SchemeHandler * SchemeHandler::singleton = nullptr;

SchemeHandler::SchemeHandler(QObject *parent)
{
    SchemeHandler::singleton = this;
};
void SchemeHandler::requestStarted(QWebEngineUrlRequestJob *job)
{
    const QByteArray method = job->requestMethod();
    const QUrl url = job->requestUrl();
    std::cout << url.toString().toStdString() << std::endl;
    std::string myString = "<html><body><h1>Hello World</h1><script src=\"/script.js\"></script></body></html>";
    QByteArray result = QByteArray::fromStdString(myString);
    auto buffer = new QBuffer(job);
    buffer->setData(result);
    job->reply("text/html", buffer);
}

int QtGUI::run(int &argc, char **argv, std::function<void()> onReady)
{
    QWebEngineUrlScheme scheme("fs");
    scheme.setSyntax(QWebEngineUrlScheme::Syntax::HostAndPort);
    scheme.setDefaultPort(80);
    scheme.setFlags(QWebEngineUrlScheme::SecureScheme);
    QWebEngineUrlScheme::registerScheme(scheme);

    app = new QApplication(argc, argv);

    SchemeHandler *handler = new SchemeHandler();
    QWebEngineProfile::defaultProfile()->installUrlSchemeHandler("fs", handler);

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
    std::string id = gen_random(6);
    windowQt = new QMainWindow;
    SchemeHandler::singleton->activeHosts[id] = this;
    windowQt->show();
    windowQt->resize(600, 400);
    webEngineView = new QWebEngineView(windowQt);
    QUrl url = QUrl::fromUserInput(QString::fromStdString("fs://" + id));
    webEngineView->load(url);
    windowQt->setCentralWidget(webEngineView);
}

void QtWindow::onMessage(std::string type, std::string message)
{
}

void QtWindow::close() {}

void QtWindow::bringToFront(bool reload) {}

void QtWindow::setFullscreen() {}