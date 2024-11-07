using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Windows.Storage.Streams;

namespace windows
{
    unsafe internal class Instance
    {
        private Boolean isEditor;
        private String id;

        private byte[] header;

        [DllImport("win-x86_64.dll")]
        public static extern int call(byte* payload, int size, byte **response);
        [DllImport("win-x86_64.dll")]
        public static extern void freePtr(void* ptr);


        public Instance(Boolean isEditor, String id) { 
            this.isEditor = isEditor;
            this.id = id;

            if (isEditor)
            {
                this.header = new byte[] { 1 }; // isEditor
                this.header = App.combineBuffers([this.header, App.numberToByte(0)]); // no project id
            }
            else { 
                // TODO
            }
        }

        public byte[] callLib(byte[] payload) {
            byte[] data = App.combineBuffers([this.header, payload]);

            byte[] responsePtr;

            fixed (byte* p = data, r = responsePtr)
            {
                int responseLength = call(p, data.Length, &r);

                byte[] response = new byte[responseLength];
                Marshal.Copy((IntPtr)r, response, 0, responseLength);

                freePtr(r);

                return response;
            }
        }

    }
}
