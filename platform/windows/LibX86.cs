using System.Diagnostics;
using System.Runtime.InteropServices;

namespace FullStacked
{
    unsafe internal class LibX86 : Lib
    {
        const string dllName = "win32-x86.dll";

        [DllImport(dllName)]
        public static extern void directories(void* root, void* config, void* editor);
        [DllImport(dllName)]
        public static extern void callback(CallbackDelegate cb);

        [DllImport(dllName)]
        public static extern int call(int id, byte* payload, int size);
        [DllImport(dllName)]
        public static extern void getResponse(int id, byte* ptr);
        [DllImport(dllName)]
        public static extern void freePtr(void* ptr);

        public override unsafe void setDirectories(void* root, void* config, void* editor)
        {
            directories(root, config, editor);
        }

        public override void setCallback(CallbackDelegate cb)
        {
            callback(cb);
        }

        public override unsafe int callLib(int id, byte* payload, int size)
        {
            return call(id, payload, size);
        }

        public override unsafe void getReponseLib(int id, byte* ptr)
        {
            getResponse(id, ptr);
        }

        public override unsafe void freePtrLib(void* ptr)
        {
            freePtr(ptr);
        }
    }
}
