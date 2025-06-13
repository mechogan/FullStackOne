#include "./win.h"
#include <windows.h>

CoreLib loadLibrary(std::string libPath) {
    HINSTANCE coreLib = LoadLibrary(libPath.c_str());

    CoreLib lib = {
        (Directories)GetProcAddress(coreLib, "directories"),
        (Callback)GetProcAddress(coreLib, "callback"),
        (Call)GetProcAddress(coreLib, "call"),
        (GetResponse)GetProcAddress(coreLib, "getResponse"),
    };

    return lib;
}