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

        [DllImport("win-x86_64.dll")]
        public static extern void directories(void* root, void* config, void* nodeModules, void* editor);

        public App()
        {
            this.InitializeComponent();
        }

        protected override void OnLaunched(LaunchActivatedEventArgs args)
        {
            string userDir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string root = Path.Combine(userDir, "FullStacked");
            string config = Path.Combine(userDir, ".config", "fullstacked");
            string nodeModules = Path.Combine(root, "node_modules");
            string editor = Path.Combine(Windows.ApplicationModel.Package.Current.InstalledPath, "editor");

            byte[] rootBytes = Encoding.UTF8.GetBytes(root);
            byte[] configBytes = Encoding.UTF8.GetBytes(config);
            byte[] nodeModulesBytes = Encoding.UTF8.GetBytes(nodeModules);
            byte[] editorBytes = Encoding.UTF8.GetBytes(editor);

            fixed (void* rootPtr = rootBytes, 
                configPtr = configBytes, 
                nodeModulesPtr = nodeModulesBytes,
                editorPtr = editorBytes) {
                directories(
                    rootPtr,
                    configPtr,
                    nodeModulesPtr,
                    editorPtr
                    );
            }

            


            this.editor = new WebView(new Instance(true, ""));
        }
        private WebView editor;

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
            byte[] combined = new byte[buffers.Sum(x => x.Length)];
            int offset = 0;
            foreach (byte[] buffer in buffers)
            {
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