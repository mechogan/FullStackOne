#include "./qt.h"
#include <iostream>

#include <QWebEngineProfile>
#include <QWebChannel>
#include <QBuffer>
#include <map>
#include "../utils.h"

SchemeHandler *SchemeHandler::singleton = nullptr;

SchemeHandler::SchemeHandler(QObject *parent)
{
    SchemeHandler::singleton = this;
};
void SchemeHandler::requestStarted(QWebEngineUrlRequestJob *job)
{
    const QByteArray method = job->requestMethod();
    const QUrl url = job->requestUrl();
    std::string host = url.host().toStdString();
    std::cout << url.host().toStdString() << std::endl;

    std::cout << url.path().toStdString() << std::endl;

    auto win = activeHosts.find(host);
    if (win != activeHosts.end())
    {
        Response res = win->second->onRequest(url.toString().toStdString());
        std::cout << res.type << std::endl;
        QByteArray result = QByteArray((char *)res.data.data(), res.data.size());
        auto buffer = new QBuffer(job);
        buffer->setData(result);
        job->reply(QByteArray::fromStdString(res.type), buffer);
    }
}

QString Bridge::call(const QString &message)
{
    return QString::fromStdString(window->onBridge(message.toStdString()));
}

int QtGUI::run(int &argc, char **argv, std::function<void()> onReady)
{
    QWebEngineUrlScheme scheme("fs");
    scheme.setSyntax(QWebEngineUrlScheme::Syntax::HostAndPort);
    scheme.setDefaultPort(80);
    scheme.setFlags(
        QWebEngineUrlScheme::SecureScheme |
        QWebEngineUrlScheme::LocalAccessAllowed |
        QWebEngineUrlScheme::ViewSourceAllowed |
        QWebEngineUrlScheme::ContentSecurityPolicyIgnored |
        QWebEngineUrlScheme::CorsEnabled |
        QWebEngineUrlScheme::FetchApiAllowed);
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

    QWebEnginePage *page = webEngineView->page();
    QWebChannel *channel = new QWebChannel(page);
    bridge = new Bridge();
    bridge->window = this;
    channel->registerObject("bridge", bridge);
    page->setWebChannel(channel);

    QUrl url = QUrl::fromUserInput(QString::fromStdString("fs://" + id));
    webEngineView->load(url);
    windowQt->setCentralWidget(webEngineView);
}

void QtWindow::onMessage(std::string type, std::string message)
{
    bridge->core_message(QString::fromStdString(type), QString::fromStdString(message));
}

void QtWindow::close()
{
}

void QtWindow::bringToFront(bool reload)
{
    windowQt->raise();
    windowQt->show();
    windowQt->activateWindow();
    if(reload) {
        webEngineView->reload();
    }
}

void QtWindow::setFullscreen()
{
    windowQt->setWindowState(Qt::WindowFullScreen);
    windowQt->show();
}