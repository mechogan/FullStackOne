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
    func updateUIView(_ uiView: WKWebView, context: Context) {
        
    }
    
    let port: Int
    
    func makeUIView(context: Context) -> WKWebView  {
        let server = Server(port: UInt16(port))
        try! server.start()
        let wkwebView = FullScreenWKWebView()
        let request = URLRequest(url: URL(string: "http://localhost:" + String(port))!)
        wkwebView.load(request)
        return wkwebView
    }
}
