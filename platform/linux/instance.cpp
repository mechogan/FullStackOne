#include "./instance.h"
#include "./utils.h"
#include <iostream>
#include "./bin/linux-x86_64.h"
#include "./app.h"

std::string notFound = "Not Found";

void Instance::webKitURISchemeRequestCallback(WebKitURISchemeRequest *request, gpointer userData)
{
    Instance *instance = static_cast<Instance *>(userData);

    std::string pathname = webkit_uri_scheme_request_get_path(request);

    std::cout << "PATH: " << pathname << std::endl;

    std::vector<unsigned char> responseData = std::vector<unsigned char>((unsigned char *)notFound.data(), (unsigned char *)notFound.data() + notFound.size());
    ;
    std::string responseType = "text/plain";
    if (pathname == "/platform")
    {
        std::string platformStr = "linux";
        responseData = std::vector<unsigned char>((unsigned char *)platformStr.data(), (unsigned char *)platformStr.data() + platformStr.size());
    }
    else
    {
        char *payloadHeader = new char[2];
        payloadHeader[0] = 1; // Static File Serving
        payloadHeader[1] = 2; // STRING

        char *pathnameData = pathname.empty() ? new char[0] : pathname.data();
        int pathnameSize = pathname.size();
        char *pathnameSizeBuffer = numberToByte(pathnameSize);

        char *payloadBody = new char[4 + pathnameSize];
        int payloadBodySize = combineBuffers(
            pathnameSizeBuffer,
            4,
            pathnameData,
            pathnameSize,
            payloadBody);

        char *payload = new char[2 + payloadBodySize];
        int payloadSize = combineBuffers(
            payloadHeader,
            2,
            payloadBody,
            payloadBodySize,
            payload);

        auto libResponse = instance->callLib(payload, payloadSize);
        std::vector<DataValue> values = deserializeArgs(libResponse);

        responseType = values.at(0).str;
        responseData = values.at(1).buffer;

        free(payload);
    }

    char *data = new char[responseData.size()];
    memcpy(data, responseData.data(), responseData.size());

    GInputStream *inputStream = g_memory_input_stream_new();
    g_memory_input_stream_add_data(G_MEMORY_INPUT_STREAM(inputStream), data, responseData.size(), [](void *ptr)
                                   { free(ptr); });
    webkit_uri_scheme_request_finish(request, inputStream, responseData.size(), responseType.c_str());
}

void Instance::onScriptMessage(WebKitUserContentManager *manager, JSCValue *value, gpointer userData)
{
    Instance *instance = static_cast<Instance *>(userData);

    std::string b64(jsc_value_to_string(value));

    unsigned long size = b64.size();
    guchar *data = g_base64_decode(b64.data(), &size);

    char *reqId = new char[4];
    memcpy(reqId, data, 4);
    size -= 4;

    auto libResponse = instance->callLib(
        reinterpret_cast<char *>(data) + 4,
        size);

    char *responseWithId = new char[libResponse.size() + 4];
    int responseWithIdSize = combineBuffers(
        reqId,
        4,
        reinterpret_cast<char *>(libResponse.data()),
        libResponse.size(),
        responseWithId);

    std::string b64res = g_base64_encode(
        reinterpret_cast<unsigned char *>(responseWithId),
        responseWithIdSize);

    std::string script = "window.respond(`" + b64res + "`);";

    webkit_web_view_evaluate_javascript(
        instance->webview,
        script.data(),
        script.size(),
        nullptr,
        "core",
        nullptr,
        nullptr,
        nullptr);
}

Instance::Instance(std::string pId, bool pIsEditor)
{
    id = pId;
    isEditor = pIsEditor;

    if (isEditor)
    {
        char *isEditorHeader = new char[1];
        isEditorHeader[0] = 1;
        headerSize = combineBuffers(
            isEditorHeader,
            1,
            numberToByte(0),
            4,
            header);
    }
    else
    {
        char *isEditorHeader = new char[1];
        isEditorHeader[0] = 0;

        char *idStrData = id.data();
        int idStrLength = id.size();

        char *intermediateBuffer = new char[1 + 4];
        headerSize = combineBuffers(
            isEditorHeader,
            1,
            numberToByte(idStrLength),
            4,
            intermediateBuffer);
        header = new char[headerSize + idStrLength];
        headerSize = combineBuffers(
            intermediateBuffer,
            headerSize,
            idStrData,
            idStrLength,
            header);
    }

    set_default_size(800, 600);

    webview = WEBKIT_WEB_VIEW(webkit_web_view_new());
    Gtk::Widget *three = Glib::wrap(GTK_WIDGET(webview));

    std::string scheme = gen_random(6);

    webkit_web_context_register_uri_scheme(
        webkit_web_view_get_context(webview),
        scheme.c_str(),
        Instance::webKitURISchemeRequestCallback,
        this,
        nullptr);

    set_child(*three);
    WebKitSettings *settings = webkit_web_view_get_settings(webview);
    webkit_settings_set_enable_developer_extras(settings, true);
    webkit_web_view_load_uri(webview, (scheme + "://localhost").c_str());

    WebKitUserContentManager *ucm =
        webkit_web_view_get_user_content_manager(webview);
    webkit_user_content_manager_register_script_message_handler(
        ucm,
        "bridge",
        NULL);
    g_signal_connect(ucm, "script-message-received::bridge",
                     G_CALLBACK(Instance::onScriptMessage), this);
}

std::vector<unsigned char> Instance::callLib(char *data, int size)
{
    char *tmpHeader = new char[headerSize];
    memcpy(tmpHeader, header, headerSize);

    char *payload = new char[headerSize + size];
    int payloadSize = combineBuffers(
        tmpHeader,
        headerSize,
        data,
        size,
        payload);

    void *libResponseData = new char[0];
    int libResponseSize = call(payload, payloadSize, &libResponseData);

    free(payload);

    return std::vector<unsigned char>((unsigned char *)libResponseData, (unsigned char *)libResponseData + libResponseSize);
}

void Instance::onMessage(char *type, char *message)
{
    if(isEditor && std::string(type) == "open") {
        App::instance->open(std::string(message), false);
        return;
    }


    std::string script = "window.oncoremessage(`" + std::string(type) + "`, `" + std::string(message) + "`);";

    webkit_web_view_evaluate_javascript(
        webview,
        script.data(),
        script.size(),
        nullptr,
        "core_message",
        nullptr,
        nullptr,
        nullptr);
}