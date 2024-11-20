using Microsoft.UI.Xaml;
using System.Runtime.InteropServices;
using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;

namespace windows
{

    unsafe public partial class App : Application
    {
        public App()
        {
            this.InitializeComponent();
        }

        protected override void OnLaunched(LaunchActivatedEventArgs args)
        {
            setDirectories();

            cb = new CallbackDelegate(onCallback);
            callback(cb);

            WebView editor = new WebView(new Instance("", true));
            this.bringToFront(editor);
        }
        private readonly Dictionary<string, (Window, WebView)> webviews = new();
        private CallbackDelegate cb;

        private void bringToFront(WebView webview) {
            String projectId = webview.instance.id;

            if (this.webviews.ContainsKey(projectId)) {
                Window window = this.webviews[projectId].Item1;
                window.DispatcherQueue.TryEnqueue(() =>
                {
                    window.Activate();
                    webview.webview.Reload();
                });
                return;
            }

            Window newWindow = new();
            newWindow.Content = webview.webview;
            newWindow.Activate();
            this.webviews.Add(projectId, (newWindow, webview));
            newWindow.Closed += delegate (object sender, WindowEventArgs args)
            {
                this.webviews.Remove(projectId);
            };
        }

        public void onCallback(string projectId, string messageType, string message)
        {
            if (!webviews.ContainsKey(projectId)) return;

            if (projectId == "" && messageType == "open") {
                if (webviews.ContainsKey(message))
                {
                    this.bringToFront(webviews[message].Item2);
                }
                else
                {
                    this.bringToFront(new WebView(new Instance(message)));
                }
                return;
            }

            WebView webview = webviews[projectId].Item2;
            webview.onMessage(messageType, message);
        }

        // DLL Lib Bridge


        [DllImport("win-x86_64.dll")]
        public static extern void directories(void* root, void* config, void* editor);
        [DllImport("win-x86_64.dll")]
        public static extern void callback(CallbackDelegate cb);

        public delegate void CallbackDelegate(string projectId, string messageType, string message);

        [DllImport("win-x86_64.dll")]
        public static extern int call(byte* payload, int size, byte** response);
        [DllImport("win-x86_64.dll")]
        public static extern void freePtr(void* ptr);


        public static void setDirectories()
        {
            string userDir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string root = Path.Combine(userDir, "FullStacked");
            string config = Path.Combine(userDir, ".config", "fullstacked");
            string editor = Path.Combine(Windows.ApplicationModel.Package.Current.InstalledPath, "editor");

            byte[] rootBytes = Encoding.UTF8.GetBytes(root);
            byte[] configBytes = Encoding.UTF8.GetBytes(config);
            byte[] editorBytes = Encoding.UTF8.GetBytes(editor);

            fixed (void* rootPtr = rootBytes,
                configPtr = configBytes,
                editorPtr = editorBytes)
            {
                directories(
                    rootPtr,
                    configPtr,
                    editorPtr
                    );
            }
        }

        public static byte[] call(byte[] payload)
        {
            byte[] responsePtr;


            fixed (byte* p = payload, r = responsePtr)
            {
                int responseLength = call(p, payload.Length, &r);

                byte[] response = new byte[responseLength];
                Marshal.Copy((IntPtr)r, response, 0, responseLength);

                freePtr(r);

                return response;
            }
        }


        // END DLL Lib Bridge


        public static byte[] numberToByte(int num)
        {
            byte[] bytes = new byte[4];
            bytes[0] = (byte)((num & 0xff000000) >> 24);
            bytes[1] = (byte)((num & 0x00ff0000) >> 16);
            bytes[2] = (byte)((num & 0x0000ff00) >> 8);
            bytes[3] = (byte)((num & 0x000000ff) >> 0);
            return bytes;
        }

        public static byte[] combineBuffers(byte[][] buffers) {
            byte[] combined = new byte[buffers.Sum(x => {
                if (x == null) {
                    return 0;
                }
                return x.Length;
            })];
            int offset = 0;
            foreach (byte[] buffer in buffers)
            {
                if (buffer == null) {
                    continue;
                }
                Array.Copy(buffer, 0, combined, offset, buffer.Length);
                offset += buffer.Length;
            }
            return combined;
        }

        public static void PrintByteArray(byte[] bytes)
        {
            var sb = new StringBuilder("new byte[] { ");
            foreach (var b in bytes)
            {
                sb.Append(b + ", ");
            }
            sb.Append("}");
            Trace.WriteLine(sb.ToString());
        }

        public static int bytesToNumber(byte[] bytes) {
            uint value = 0;
            foreach (byte b in bytes) {
                value = value << 8;
                value = value | b;
            }
            return (int)value;
        }

        public static int deserializeNumber(byte[] bytes) {
            bool negative = bytes[0] == 1;

            uint n = 0;
            int i = 1;
            while (i <= bytes.Length)
            {
                n += ((uint)bytes[i]) << ((i - 1) * 8);
                i += 1;
            }

            int value = (int)n;

            if (negative) {
                return 0 - value;
            }

            return value;
        }

        public static List<DataValue> deserializeArgs(byte[] bytes) {
            List<DataValue> args = new List<DataValue>();

            int cursor = 0;
            while (cursor < bytes.Length) { 
                DataType type = (DataType)bytes[cursor];
                cursor++;
                int length = bytesToNumber(bytes[new Range(cursor, cursor + 4)]);
                cursor += 4;
                byte[] arg = bytes[new Range(cursor, cursor + length)];
                cursor += length;

                switch (type) {
                    case DataType.UNDEFINED:
                        args.Add(new DataValue());
                        break;
                    case DataType.BOOLEAN:
                        DataValue b = new()
                        {
                            boolean = arg[0] == 1 ? true : false
                        };
                        args.Add(b);
                        break;
                    case DataType.NUMBER:
                        DataValue n = new()
                        {
                            number = deserializeNumber(arg)
                        };
                        args.Add(n);
                        break;
                    case DataType.STRING:
                        DataValue s = new()
                        {
                            str = Encoding.UTF8.GetString(arg)
                        };
                        args.Add(s);
                        break;
                    case DataType.BUFFER:
                        DataValue buf = new()
                        {
                            buffer = arg
                        };
                        args.Add(buf);
                        break;
                    default:
                        break;
                }
            }

            return args;
        }
    }

    public class DataValue {
        public bool boolean;
        public string str;
        public int number;
        public byte[] buffer;
    }

}

enum DataType : int
{
    UNDEFINED = 0,
    BOOLEAN = 1,
    STRING = 2,
    NUMBER = 3,
    BUFFER = 4
}