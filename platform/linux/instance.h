#ifndef INSTANCE_H_
#define INSTANCE_H_

#include <gtkmm/application.h>
#include <webkit/webkit.h>

class Instance : public Gtk::Window
{
private:
    std::string id;
    bool isEditor;
    char *header;
    int headerSize;

public:
    WebKitWebView *webview;

    static void webKitURISchemeRequestCallback(WebKitURISchemeRequest *request, gpointer userData);

    static void onScriptMessage(WebKitUserContentManager *manager, JSCValue *value, gpointer userData);

    Instance(std::string pId, bool pIsEditor);

    std::vector<unsigned char> callLib(char *data, int size);

    void onMessage(char* type, char* message);
};

#endif