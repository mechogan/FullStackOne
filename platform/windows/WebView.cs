using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.VisualBasic;
using Microsoft.Web.WebView2.Core;
using System;
using System.IO;
using System.Text;
using Windows.Storage.Streams;

namespace windows
{
    internal class WebView
    {
        private Window window;
        private WebView2 webview;

        public WebView()
        {
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
                IRandomAccessStream stream = new MemoryStream(Encoding.UTF8.GetBytes("<h1>FullStacked</h1>")).AsRandomAccessStream();
                CoreWebView2WebResourceResponse response = this.webview.CoreWebView2.Environment.CreateWebResourceResponse(stream, 200, "OK", "Content-Type: text/html");
                args.Response = response;
            };
            this.webview.Source = new Uri("http://localhost");
        }
    }
}
