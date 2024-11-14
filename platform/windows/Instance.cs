using System;
using System.Linq;
using System.Text;

namespace windows
{
    internal class Instance
    {
        private Boolean isEditor;
        private String id;

        private byte[] header;

        public Instance(Boolean isEditor, String id) { 
            this.isEditor = isEditor;
            this.id = id;

            if (isEditor)
            {
                this.header = new byte[] { 1 }; // isEditor
                this.header = App.combineBuffers([this.header, App.numberToByte(0)]); // no project id
            }
            else { 
                this.header = new byte[] { 0 };
                byte[] idData = Encoding.UTF8.GetBytes(id);
                this.header = App.combineBuffers([this.header, App.numberToByte(idData.Length)]);
                this.header = App.combineBuffers([this.header, idData]);
            }
        }

        public byte[] callLib(byte[] payload) {
            byte[] data = App.combineBuffers([this.header, payload]);

            return App.call(data);
        }

    }
}
