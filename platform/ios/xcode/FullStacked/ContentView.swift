import SwiftUI
import WebKit

struct ContentView: View {
    @State private var ports: [Int] = []
    
    var body: some View {
        VStack {
            Button("Run") {
                ports.append(9000 + ports.count)
            }
            ForEach(ports, id: \.self) { port in
                WebView(port: port)
            }
        }
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
