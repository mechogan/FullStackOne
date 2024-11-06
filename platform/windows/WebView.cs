using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using Windows.UI.WebUI;

namespace windows
{
    internal class WebView
    {
        private Window window;
        private WebView2 webview;

        public WebView() {
            this.window = new Window();
            this.webview = new WebView2();
            window.Content = this.webview;
            window.Activate();
            this.Init();
        }

        async public void Init() {
            await this.webview.EnsureCoreWebView2Async();
            this.webview.Source = new Uri("https://fullstacked.org");
        }
    }
}
