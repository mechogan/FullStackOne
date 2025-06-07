#ifndef GUI_H_
#define GUI_H_

#include <functional>
#include <string>

struct Response {
        std::string type;
        std::vector<unsigned char> data;
};

class Window {
    public:
        virtual ~Window() = default;

        std::function<Response(std::string)> onRequest = nullptr;
        std::function<std::string(std::string)> onBridge = nullptr;

        virtual void onMessage(std::string type, std::string message) {};

        virtual void close() {};

        virtual void bringToFront(bool reload) {};

        virtual void setFullscreen() {};
};

class GUI {
    public:
        virtual ~GUI() = default;

        virtual void createApp() {};

        virtual int run(int &argc, char **argv, std::function<void()> onReady) {
            return 0;
        };

        virtual Window *
        createWindow(std::function<Response(std::string)> onRequest,
                     std::function<std::string(std::string)> onBridge) {
            return nullptr;
        };
};

#endif