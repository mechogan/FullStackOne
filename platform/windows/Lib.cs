namespace FullStacked
{
    unsafe internal abstract class Lib
    {
        public abstract void setDirectories(void* root, void* config, void* editor);
        public abstract void setCallback(CallbackDelegate cb);

        public delegate void CallbackDelegate(string projectId, string messageType, string message);

        public abstract int callLib(byte* payload, int size, byte** response);
        public abstract void freePtrLib(void* ptr);
    }
}
