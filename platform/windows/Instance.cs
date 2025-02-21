using System;
using System.Linq;
using System.Text;
using Windows.UI.Popups;

namespace FullStacked
{
    internal class Instance
    {
        public String id;

        private byte[] header;

        public Instance(String id, Boolean isEditor = false) {
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
