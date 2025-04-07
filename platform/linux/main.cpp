#include <gtkmm/application.h>
#include <webkit/webkit.h>


class MyWindow : public Gtk::Window
{
public:
  MyWindow();
};

MyWindow::MyWindow()
{
  set_default_size(800, 600);

  WebKitWebView *one = WEBKIT_WEB_VIEW(webkit_web_view_new());
  Gtk::Widget *three = Glib::wrap(GTK_WIDGET(one));

  set_child(*three);
  webkit_web_view_load_uri(one, "http://fullstacked.org");
}

int main(int argc, char* argv[])
{
  auto app = Gtk::Application::create("org.gtkmm.examples.base");

  return app->make_window_and_run<MyWindow>(argc, argv);
}