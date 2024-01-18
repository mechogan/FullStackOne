import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebView(port: 9000)
            .edgesIgnoringSafeArea(.all)
    }
}

#Preview {
    ContentView()
}

struct WebView: UIViewRepresentable {
    func updateUIView(_ uiView: WKWebView, context: Context) {
        
    }
    
    let port: Int
    
    func makeUIView(context: Context) -> WKWebView  {
        let server = Server(port: UInt16(port))
        try! server.start()
        let wkwebView = WKWebView()
        let request = URLRequest(url: URL(string: "http://localhost:" + String(port))!)
        wkwebView.load(request)
        return wkwebView
    }
}
