using Microsoft.UI.Xaml;

namespace windows
{
    public partial class App : Application
    {
        public App()
        {
            this.InitializeComponent();
        }

        protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
        {
            this.editor = new WebView();
        }

        private WebView editor;
    }
}
