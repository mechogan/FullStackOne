using System.Runtime.InteropServices;

namespace FullStacked
{
    unsafe internal class LibARM64 : Lib
    {

        const string dllName = "win-arm64.dll";

        [DllImport(dllName)]
        public static extern void directories(void* root, void* config, void* editor);
        [DllImport(dllName)]
        public static extern void callback(CallbackDelegate cb);

        [DllImport(dllName)]
        public static extern int call(byte* payload, int size, byte** response);
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

        public override unsafe int callLib(byte* payload, int size, byte** response)
        {
            return call(payload, size, response);
        }

        public override unsafe void freePtrLib(void* ptr)
        {
            freePtr(ptr);
        }
    }
}
