typedef void (*Directories)(char *root, char *config, char *main, char *lib);
typedef void (*Callback)(void *cb);
typedef int (*Call)(int id, void *buffer, int length);
typedef void (*GetResponse)(int id, void *ptr);

struct CoreLib {
        Directories directories;
        Callback callback;
        Call call;
        GetResponse getResponse;
};
