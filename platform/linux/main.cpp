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

int bytesToNumber(char *bytes, int size)
{
    unsigned value = 0;
    for(int i = 0; i < size; i++) {
        value = value << 8;
        value = value | bytes[i];
    }
    return value;
}

int deserializeNumber(char* bytes, int size)
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


void printBuffer(char *buffer, int size) {
    for(int i = 0; i < size; i++) {
        std::cout << (int)buffer[i] << " ";
    }
    std::cout << std::endl;
}

int combineBuffers(char *buf1, int lgt1, char *buf2, int lgt2, char *result)
{
    int combinedLength = lgt1 + lgt2;
    char* combined = new char[combinedLength];
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
    char *buffer;
    int bufferSize;
};

enum DataType {
    UNDEFINED = 0,
    BOOLEAN = 1,
    STRING = 2,
    NUMBER = 3,
    BUFFER = 4
};

std::vector<DataValue*> deserializeArgs(char *data, int size)
{
    std::vector<DataValue*> args;

    int cursor = 0;
    while (cursor < size)
    {
        DataType type = (DataType)data[cursor];

        char *lengthData = new char[0];
        char *arg = new char[0];

        cursor++;
        memcpy(lengthData, data + cursor, 4);
        int length = bytesToNumber(lengthData, 4);

        cursor += 4;
        memcpy(arg, data + cursor, length);
        cursor += length;

        DataValue *v = new DataValue();
        switch (type)
        {
        case UNDEFINED:
            break;
        case BOOLEAN:
            v->boolean = arg[0] == 1 ? true : false;
            break;
        case NUMBER:
            v->number = deserializeNumber(arg, length);
            break;
        case STRING:
            v->str = std::string(arg, length);
            break;
        case BUFFER:
            v->buffer = new char[0];
            memcpy(v->buffer, arg, length);
            v->bufferSize = length;
            break;
        default:
            break;
        }
        args.push_back(v);
    }

    return args;
}

int BYTE_READ_CHUNK = 1024;

class Instance : public Gtk::Window
{
private:
    std::string id;
    bool isEditor;
    char *header = new char[0];
    int headerSize;

public:
    static void webKitURISchemeRequestCallback(WebKitURISchemeRequest *request, gpointer userData)
    {
        Instance *instance = static_cast<Instance *>(userData);

        std::string pathname = webkit_uri_scheme_request_get_path(request);

        std::cout << "PATH: " << pathname << std::endl;

        char *responseData;
        int responseSize;
        std::string responseType = "text/plain";
        if (pathname == "/platform")
        {
            std::string platformStr = "linux";
            responseData = platformStr.data();
            responseSize = strlen(responseData);
        }
        else
        {
            char *payloadBodyHeader = new char[2];
            payloadBodyHeader[0] = 1; // Static File Serving
            payloadBodyHeader[1] = 2; // STRING

            char *pathnameData = pathname.empty() ? new char[0] : pathname.data();
            int pathnameSize = pathname.size();
            char *pathnameSizeBuffer = numberToByte(pathnameSize);

            char *payloadBodyBody = new char[0];
            int payloadBodyBodySize = combineBuffers(
                pathnameSizeBuffer,
                4,
                pathnameData,
                pathnameSize,
                payloadBodyBody);


            char *payloadBody = new char[0];
            int payloadBodySize = combineBuffers(
                payloadBodyHeader,
                2,
                payloadBodyBody,
                payloadBodyBodySize,
                payloadBody
            );

            char *tmpHeader = new char[0];
            memcpy(tmpHeader, instance->header, instance->headerSize);

            char *payload = new char[0];
            int payloadSize = combineBuffers(
                tmpHeader,
                instance->headerSize,
                payloadBody,
                payloadBodySize,
                payload);

            void *libResponseData = new char[0];
            int libResponseSize = call(payload, payloadSize, &libResponseData);

            std::vector<DataValue*> values = deserializeArgs((char *)libResponseData, libResponseSize);

            responseType = values.at(0)->str;
            responseData = values.at(1)->buffer;
            responseSize = values.at(1)->bufferSize;

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
        }

        GInputStream *inputStream = g_memory_input_stream_new();
        g_memory_input_stream_add_data(G_MEMORY_INPUT_STREAM(inputStream), responseData, responseSize, nullptr);
        webkit_uri_scheme_request_finish(request, inputStream, responseSize, responseType.c_str());
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

        WebKitWebView *webview = WEBKIT_WEB_VIEW(webkit_web_view_new());
        Gtk::Widget *three = Glib::wrap(GTK_WIDGET(webview));

        webkit_web_context_register_uri_scheme(
            webkit_web_view_get_context(webview),
            "fs",
            Instance::webKitURISchemeRequestCallback,
            this,
            nullptr);

        set_child(*three);
        webkit_web_view_load_uri(webview, "fs://localhost");
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