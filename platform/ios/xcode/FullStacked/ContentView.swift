import SwiftUI
import WebKit
import JavaScriptCore
//
//let logToWebView: @convention (block) (String) -> Void = {message in
//    var data = message.data(using: .utf8)!
//    data.append(0x0D) // CR
//    data.append(0x0A) // LF
//    server.getWebSocketConnections().forEach { websocket in
//        websocket.send(data: data)
//    }
//}
//
//let run: @convention (block) (String, String) -> Void = { workdir, entrypoint in
//    let projectdir = homedir + "/" + workdir
//    
//    let server = Server(workdir: projectdir, assetdir: projectdir)
//    
//    RunningServers.instance?.addRunningServer(server: server)
//    
//    let js = JavaScript(workdir: workdir)
//    js.context["console"]?["_log"] = logToWebView
//    
//    let entrypoint = projectdir + "/" + entrypoint
//    
//    let str = UnsafeMutablePointer<Int8>(mutating: (entrypoint as NSString).utf8String)
//    let script = String.init(cString: build(str)!, encoding: .utf8)!
//    
//    js.run(script: script)
//}
//
//let assetdir = Bundle.main.bundlePath + "/webview"
//
//let server = Server(workdir: Bundle.main.bundlePath + "/webview", assetdir: assetdir)
//
//struct RunningServer: Identifiable {
//    var id: Int
//    var server: Server
//}
//
//class RunningServers: ObservableObject {
//    @Published var servers = [RunningServer]()
//    static var instance: RunningServers?
//    
//    init(){
//        RunningServers.instance = self
//    }
//    
//    func addRunningServer(server: Server){
//        self.servers.append(RunningServer(id: self.servers.count, server: server))
//    }
//    
//    func removeRunningServer(runningServer: RunningServer) {
//        runningServer.server.stop()
//        
//        self.servers.removeAll { activeRunningServer in
//            return activeRunningServer.id == runningServer.id
//        }
//    }
//}

struct ContentView: View {
//    @ObservedObject var runningServers: RunningServers = RunningServers()
    
//    init(){
//        server.js.context["run"] = run
//    }
    
    var body: some View {
        ZStack {
            WebView()
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .edgesIgnoringSafeArea(.all)
                .ignoresSafeArea()
//            ForEach(self.runningServers.servers) {runningServer in
//                VStack {
//                    Button("Close") {
//                        self.runningServers.removeRunningServer(runningServer: runningServer)
//                    }
//                        .buttonStyle(.borderedProminent)
//                    WebView(runningServer: runningServer.server)
//                        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
//                        .edgesIgnoringSafeArea(.all)
//                        .ignoresSafeArea()
//                }
//                .background(Color.black)
//            }
        }
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
        let wkConfig = WKWebViewConfiguration()
        
        let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
        let directoryDir = paths.first!
        
        let assetdir = Bundle.main.bundlePath + "/webview"
        let js = JavaScript(
            fsdir: directoryDir,
            assetdir: assetdir,
            entrypoint: Bundle.main.bundlePath + "/api/index.js"
        )
        js.privileged = true
        
        wkConfig.setURLSchemeHandler(RequestHandler(js: js),  forURLScheme: "fs")
        let wkWebView = FullScreenWKWebView(frame: CGRect(x: 0, y: 0, width: 100, height: 100), configuration: wkConfig)
        
        let webviewEntrypoint = assetdir + "/index.html"
        let webviewEntrypointData = FileManager.default.contents(atPath: webviewEntrypoint)!
        let webviewEntrypointHTMLString = String(data: webviewEntrypointData, encoding: .utf8)!
        wkWebView.loadHTMLString(webviewEntrypointHTMLString, baseURL: URL(string: "fs://localhost"))
        return wkWebView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {

    }
}

class RequestHandler: NSObject, WKURLSchemeHandler {
    let js: JavaScript
    
    init(js: JavaScript) {
        self.js = js
    }
    
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let request = urlSchemeTask.request
        
        let headers = request.allHTTPHeaderFields!
        let pathname = String(request.url!.pathComponents.joined(separator: "/").dropFirst())
        let body = request.httpBody
        
        let jsResponse = self.js.processRequest(headers: headers, pathname: pathname, body: body)
        
        
        let responseBody = jsResponse.data != nil
            ? jsResponse.data!
            : nil
        
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: responseBody != nil
                ? [
                    "Content-Type": jsResponse.mimeType,
                    "Content-Length": String(responseBody!.count)
                ]
            : nil
        )!
        
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(responseBody == nil ? Data() : responseBody!)
        urlSchemeTask.didFinish()
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        
    }
}
