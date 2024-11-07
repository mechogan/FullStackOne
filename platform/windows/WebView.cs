using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using Windows.Storage.Streams;

namespace windows
{
    internal class WebView
    {
        private Window window;
        private WebView2 webview;
        private Instance instance;

        public WebView(Instance instance)
        {
            this.instance = instance;
            this.window = new Window();
            this.webview = new WebView2();
            window.Content = this.webview;
            window.Activate();
            this.Init();
        }

        async public void Init()
        {
            await this.webview.EnsureCoreWebView2Async();
            this.webview.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            this.webview.CoreWebView2.WebResourceRequested += delegate (CoreWebView2 sender, CoreWebView2WebResourceRequestedEventArgs args)
            {
                Uri uri = new(args.Request.Uri);
                String pathname = uri.LocalPath;

                Trace.WriteLine(pathname);

                if (pathname == "/platform") {
                    IRandomAccessStream stream = new MemoryStream(Encoding.UTF8.GetBytes("windows")).AsRandomAccessStream();
                    args.Response = this.webview.CoreWebView2.Environment.CreateWebResourceResponse(stream, 200, "OK", "Content-Type: text/html");
                    return;
                }

                // static file serving


                byte[] header = new byte[] {
                    1, // Static File Serving
                    2  // STRING
                };

                byte[] pathnameData = Encoding.UTF8.GetBytes(pathname);
                byte[] pathnameLength = App.numberToByte(pathnameData.Length);
                byte[] payload = App.combineBuffers([header, pathnameLength, pathnameData]);

                byte[] response = this.instance.callLib(payload);

                List<DataValue> values = App.deserializeArgs(response);

                if (values.Count == 0) {
                    IRandomAccessStream notFoundStream = new MemoryStream(Encoding.UTF8.GetBytes("Not Found")).AsRandomAccessStream();
                    args.Response = this.webview.CoreWebView2.Environment.CreateWebResourceResponse(notFoundStream, 404, "OK", "Content-Type: text/plain");
                    return;
                }

                IRandomAccessStream resStream = new MemoryStream(values[1].buffer).AsRandomAccessStream();
                args.Response = this.webview.CoreWebView2.Environment.CreateWebResourceResponse(resStream, 200, "OK", "Content-Type: " + values[0].str);
            };
            this.webview.Source = new Uri("http://localhost");
        }
    }
}
