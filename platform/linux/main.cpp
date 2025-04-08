#include <gtkmm/application.h>
#include <webkit/webkit.h>
#include <gtkmm/window.h>
#include <gtkmm/button.h>
#include <iostream>
#include "./bin/linux-x86_64.h"

std::string getexedir()
{
    char result[PATH_MAX];
    ssize_t count = readlink("/proc/self/exe", result, PATH_MAX);
    std::string path = std::string(result, (count > 0) ? count : 0);
    std::size_t pos = path.find_last_of("/");
    return path.substr(0, pos);
}

void setDirectories()
{
    std::string home = getenv("HOME");
    std::string root = home + "/FullStacked";
    std::string config = home + "/.config/fullstacked";
    std::string editor = getexedir() + "/editor";

    directories(
        root.data(),
        config.data(),
        editor.data());
}

void libCallback(char *projectId, char *type, char *msg)
{
    std::cout << msg << std::endl;
}

char *numberToByte(int number)
{
    char *bytes = new char[4];
    bytes[0] = ((number & 0xff000000) >> 24);
    bytes[1] = ((number & 0x00ff0000) >> 16);
    bytes[2] = ((number & 0x0000ff00) >> 8);
    bytes[3] = ((number & 0x000000ff) >> 0);
    return bytes;
}

unsigned bytesToNumber(unsigned char *bytes, int size)
{
    unsigned value = 0;
    for (int i = 0; i < size; i++)
    {
        value = value << 8;
        value = value | (unsigned)bytes[i];
    }
    return value;
}

int deserializeNumber(char *bytes, int size)
{
    bool negative = bytes[0] == 1;

    unsigned n = 0;
    int i = 1;
    while (i <= size)
    {
        n += ((unsigned)bytes[i]) << ((i - 1) * 8);
        i += 1;
    }

    int value = (int)n;

    if (negative)
    {
        return 0 - value;
    }

    return value;
}

void printBuffer(char *buffer, int size)
{
    for (int i = 0; i < size; i++)
    {
        std::cout << (int)buffer[i] << " ";
    }
    std::cout << std::endl;
}

int combineBuffers(char *buf1, int lgt1, char *buf2, int lgt2, char *result)
{
    int combinedLength = lgt1 + lgt2;
    char *combined = new char[combinedLength];
    for (int i = 0; i < lgt1; i++)
    {
        combined[i] = buf1[i];
    }
    for (int i = 0; i < lgt2; i++)
    {
        combined[i + lgt1] = buf2[i];
    }
    memcpy(result, combined, combinedLength);
    return combinedLength;
}

class DataValue
{
public:
    bool boolean;
    std::string str;
    int number;
    std::vector<unsigned char> buffer;
};

enum DataType
{
    UNDEFINED = 0,
    BOOLEAN = 1,
    STRING = 2,
    NUMBER = 3,
    BUFFER = 4
};

std::vector<DataValue> deserializeArgs(std::vector<unsigned char> data)
{
    std::vector<DataValue> args;

    std::cout << "Args Size: " << data.size() << std::endl;

    int cursor = 0;

    while (cursor < data.size())
    {
        DataType type = (DataType)data.at(cursor);

        cursor++;
        std::vector<unsigned char> lengthData(data.begin() + cursor, data.begin() + cursor + 4);
        int length = bytesToNumber(reinterpret_cast<unsigned char *>(lengthData.data()), 4);

        std::cout << "Type: " << type << " Length: " << length << std::endl;

        cursor += 4;
        std::vector<unsigned char> arg(data.begin() + cursor, data.begin() + cursor + length);
        cursor += length;

        DataValue v = *(new DataValue());
        switch (type)
        {
        case UNDEFINED:
            break;
        case BOOLEAN:
            v.boolean = arg.at(0) == 1 ? true : false;
            break;
        case NUMBER:
            v.number = deserializeNumber(reinterpret_cast<char *>(arg.data()), length);
            break;
        case STRING:
            v.str = std::string(reinterpret_cast<char *>(arg.data()), length);
            std::cout << v.str << std::endl;
            break;
        case BUFFER:
            v.buffer = arg;
            break;
        default:
            break;
        }
        args.push_back(v);
    }

    // delete arg;
    // delete lengthData;

    std::cout << "Arg deserialize: " << args.size() << std::endl;

    return args;
}

int BYTE_READ_CHUNK = 1024;

std::string notFound = "Not Found";

void freePointer(void *ptr)
{
    free(ptr);
}

class Instance : public Gtk::Window
{
private:
    std::string id;
    bool isEditor;
    char *header = new char[0];
    int headerSize;
    WebKitWebView * webview;

public:
    static void webKitURISchemeRequestCallback(WebKitURISchemeRequest *request, gpointer userData)
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
            char *payloadBodyHeader = new char[2];
            payloadBodyHeader[0] = 1; // Static File Serving
            payloadBodyHeader[1] = 2; // STRING

            char *pathnameData = pathname.empty() ? new char[0] : pathname.data();
            int pathnameSize = pathname.size();
            char *pathnameSizeBuffer = numberToByte(pathnameSize);

            char *payloadBodyBody = new char[4 + pathnameSize];
            int payloadBodyBodySize = combineBuffers(
                pathnameSizeBuffer,
                4,
                pathnameData,
                pathnameSize,
                payloadBodyBody);

            char *payloadBody = new char[2 + payloadBodyBodySize];
            int payloadBodySize = combineBuffers(
                payloadBodyHeader,
                2,
                payloadBodyBody,
                payloadBodyBodySize,
                payloadBody);

            char *tmpHeader = new char[instance->headerSize];
            memcpy(tmpHeader, instance->header, instance->headerSize);

            char *payload = new char[instance->headerSize + payloadBodySize];
            int payloadSize = combineBuffers(
                tmpHeader,
                instance->headerSize,
                payloadBody,
                payloadBodySize,
                payload);

            void *libResponseData = new char[0];
            int libResponseSize = call(payload, payloadSize, &libResponseData);

            std::cout << "Lib res size: " << libResponseSize << std::endl;

            std::vector<unsigned char> data((unsigned char *)libResponseData, (unsigned char *)libResponseData + libResponseSize);
            std::cout << "Data size: " << data.size() << std::endl;

            std::vector<DataValue> values = deserializeArgs(data);

            responseType = values.at(0).str;
            responseData = values.at(1).buffer;

            // GInputStream *body = webkit_uri_scheme_request_get_http_body(request);
            // char *bodyData;
            // int bodyDataSize = 0;
            // while(true) {
            //     char *chunk;
            //     gsize gBytesRead;
            //     g_input_stream_read_all(body, chunk, BYTE_READ_CHUNK, &gBytesRead, nullptr, nullptr);

            //     int bytesRead = int(gBytesRead);

            //     char *intermediateBuffer;
            //     memccpy(intermediateBuffer, bodyData, '\0', bodyDataSize);

            //     bodyDataSize = combineBuffers(
            //         intermediateBuffer,
            //         bodyDataSize,
            //         chunk,
            //         bytesRead,
            //         bodyData
            //     );

            //     if(int(bytesRead) < BYTE_READ_CHUNK){
            //         break;
            //     }
            // }
            free(libResponseData);
        }

        char *data = new char[responseData.size()];
        memcpy(data, responseData.data(), responseData.size());

        GInputStream *inputStream = g_memory_input_stream_new();
        g_memory_input_stream_add_data(G_MEMORY_INPUT_STREAM(inputStream), data, responseData.size(), [](void *ptr)
                                       { free(ptr); });
        webkit_uri_scheme_request_finish(request, inputStream, responseData.size(), responseType.c_str());
    }

    static void onScriptMessage(WebKitUserContentManager *manager, JSCValue *value, gpointer userData)
    {
        Instance *instance = static_cast<Instance *>(userData);

        std::string b64(jsc_value_to_string(value));

        std::cout << b64 << std::endl;

        unsigned long size = b64.size();
        guchar *data = g_base64_decode(b64.data(), &size);

        printBuffer(
            reinterpret_cast<char *>(data),
            size
        );

        char *reqId = new char[4];
        memcpy(reqId, data, 4);
        size -= 4;


        char *tmpHeader = new char[instance->headerSize];
        memcpy(tmpHeader, instance->header, instance->headerSize);

        char *payload = new char[instance->headerSize + size];
        int payloadSize = combineBuffers(
            tmpHeader,
            instance->headerSize,
            reinterpret_cast<char *>(data) + 4,
            size,
            payload);

        printBuffer(payload, payloadSize);

        void *libResponseData = new char[0];
        int libResponseSize = call(payload, payloadSize, &libResponseData);

        char *responseWithId = new char[libResponseSize + 4];
        int responseWithIdSize = combineBuffers(
            reqId,
            4,
            (char *)libResponseData,
            libResponseSize,
            responseWithId
        );

        std::string b64res = g_base64_encode(
            reinterpret_cast<unsigned char *>(responseWithId),
            responseWithIdSize
        );

        std::string script = "window.respond(`" + b64res + "`);";

        webkit_web_view_evaluate_javascript(
            instance->webview,
            script.data(),
            script.size(),
            nullptr,
            "core",
            nullptr,
            nullptr,
            nullptr
        );
    }

    Instance(std::string pId, bool pIsEditor)
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

            char *intermediateBuffer;
            headerSize = combineBuffers(
                isEditorHeader,
                1,
                numberToByte(idStrLength),
                4,
                intermediateBuffer);
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

        webkit_web_context_register_uri_scheme(
            webkit_web_view_get_context(webview),
            "fs",
            Instance::webKitURISchemeRequestCallback,
            this,
            nullptr);

        set_child(*three);
        WebKitSettings *settings = webkit_web_view_get_settings(webview);
        webkit_settings_set_enable_developer_extras(settings, true);
        // WebKitWebInspector *inspector = webkit_web_view_get_inspector(webview);
        // webkit_web_inspector_attach(inspector);
        // webkit_web_inspector_show(inspector);
        webkit_web_view_load_uri(webview, "fs://localhost");

        WebKitUserContentManager *ucm =
            webkit_web_view_get_user_content_manager(webview);
        webkit_user_content_manager_register_script_message_handler(
            ucm,
            "bridge",
            NULL);
        g_signal_connect(ucm, "script-message-received::bridge",
                         G_CALLBACK(Instance::onScriptMessage), this);
    }
};

int main(int argc, char *argv[])
{
    setDirectories();
    callback((void *)libCallback);

    auto app = Gtk::Application::create();

    auto main = new Instance("", true);
    main->show();

    app->signal_startup().connect([&]
                                  { app->add_window(*main); });

    return app->run();
}