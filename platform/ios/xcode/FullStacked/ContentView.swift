import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebView(port: 9000)
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
            .edgesIgnoringSafeArea(.all)
            .ignoresSafeArea()
    }
}

#Preview {
    ContentView()
}

class FullScreenWKWebView: WKWebView {
    override var safeAreaInsets: UIEdgeInsets {
        return UIEdgeInsets(top: super.safeAreaInsets.top, left: 0, bottom: 0, right: 0)
    }
}

struct WebView: UIViewRepresentable {
    let server: Server
    
    init(port: Int) {
        self.server = Server(port: UInt16(port));
    }
    
    func makeUIView(context: Context) -> WKWebView  {
        try! self.server.start()
        let request = URLRequest(url: URL(string: "http://localhost:" + String(self.server.port.rawValue))!)
        let wkWebView = FullScreenWKWebView()
        wkWebView.load(request)
        return wkWebView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if(context.environment.scenePhase == .active){
            self.server.restart()
        }
        else if (context.environment.scenePhase == .background) {
            self.server.stop()
        }
    }
}
