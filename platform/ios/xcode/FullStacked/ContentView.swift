import SwiftUI
import WebKit

let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
let homedir = paths.first!

let logToWebView: @convention (block) (String) -> Void = {message in
    var data = message.data(using: .utf8)!
    data.append(0x0D) // CR
    data.append(0x0A) // LF
    server.getWebSocketConnections().forEach { websocket in
        websocket.send(data: data)
    }
}

let run: @convention (block) (String, String) -> Void = { workdir, entrypoint in
    let js = JavaScript(workdir: workdir)
    js.context["console"]?["_log"] = logToWebView
    
    let entrypoint = homedir + "/" + workdir + "/" + entrypoint
    
    let str = UnsafeMutablePointer<Int8>(mutating: (entrypoint as NSString).utf8String)
    let script = String.init(cString: build(str)!, encoding: .utf8)!
    
    js.run(script: script)
}

let assetdir = Bundle.main.bundlePath + "/webview"

let server = Server(workdir: homedir, assetdir: assetdir)

struct ContentView: View {
    
    
    init(){
        server.js.context["run"] = run
    }
    
    var body: some View {
        WebView()
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
    func makeUIView(context: Context) -> WKWebView  {
        try! server.start()
        let request = URLRequest(url: URL(string: "http://localhost:" + String(server.port.rawValue))!)
        let wkWebView = FullScreenWKWebView()
        wkWebView.load(request)
        return wkWebView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if(context.environment.scenePhase == .active){
            server.restart()
        }
        else if (context.environment.scenePhase == .background) {
            
            // preview calls with scenePhase .background
            let isPreview = ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] ?? "0"
            if(isPreview == "1") {
                return;
            }
            
            server.stop()
        }
    }
}
