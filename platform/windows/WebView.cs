using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Web;
using Windows.Storage.Streams;

namespace windows
{
    internal class WebView
    {
        public WebView2 webview;
        public Instance instance;

        public WebView(Instance instance)
        {
            this.instance = instance;
            this.webview = new WebView2();
            this.Init();
        }

        async public void Init()
        {
            await this.webview.EnsureCoreWebView2Async();
            this.webview.CoreWebView2.WebMessageReceived += async delegate (CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
            {
                string base64 = args.TryGetWebMessageAsString();
                byte[] data = Convert.FromBase64String(base64);
                byte[] id = data[new Range(0, 4)];
                byte[] payload = data[new Range(4, data.Length)];
                byte[] libResponse = this.instance.callLib(payload);
                byte[] response = App.combineBuffers([id, libResponse]);
                _ = await this.webview.CoreWebView2.ExecuteScriptAsync("window.respond(`" + Convert.ToBase64String(response) + "`)");
            };
            this.webview.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            this.webview.CoreWebView2.WebResourceRequested += delegate (CoreWebView2 sender, CoreWebView2WebResourceRequestedEventArgs args)
            {
                Uri uri = new(args.Request.Uri);
                String pathname = uri.LocalPath;

                Trace.WriteLine(pathname);

                if (pathname == "/platform")
                {
                    IRandomAccessStream stream = new MemoryStream(Encoding.UTF8.GetBytes("windows")).AsRandomAccessStream();
                    args.Response = this.webview.CoreWebView2.Environment.CreateWebResourceResponse(stream, 200, "OK", "Content-Type: text/html");
                    return;
                }
                else if (pathname == "/call-sync")
                {
                    NameValueCollection queryDictionary = HttpUtility.ParseQueryString(uri.Query);
                    byte[] syncPayload = Convert.FromBase64String(HttpUtility.UrlDecode(queryDictionary.Get("payload")));
                    byte[] libResponse = this.instance.callLib(syncPayload);
                    IRandomAccessStream syncResStream = new MemoryStream(libResponse).AsRandomAccessStream();
                    args.Response = this.webview.CoreWebView2.Environment.CreateWebResourceResponse(syncResStream, 200, "OK", "Content-Type: application/octet-stream");
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

                if (values.Count == 0)
                {
                    IRandomAccessStream notFoundStream = new MemoryStream(Encoding.UTF8.GetBytes("Not Found")).AsRandomAccessStream();
                    args.Response = this.webview.CoreWebView2.Environment.CreateWebResourceResponse(notFoundStream, 404, "OK", "Content-Type: text/plain");
                    return;
                }

                IRandomAccessStream resStream = new MemoryStream(values[1].buffer).AsRandomAccessStream();
                args.Response = this.webview.CoreWebView2.Environment.CreateWebResourceResponse(resStream, 200, "OK", "Content-Type: " + values[0].str);
            };
            this.webview.Source = new Uri("http://localhost");
        }

        public void onMessage(string type, string message) {
            this.webview.DispatcherQueue.TryEnqueue(() =>
            {
                _ = this.webview.CoreWebView2.ExecuteScriptAsync("window.onmessage(`" + type + "`, `" + message + "`)");
            });
        }
    }
}
