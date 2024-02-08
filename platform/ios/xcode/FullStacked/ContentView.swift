import SwiftUI
import WebKit
import JavaScriptCore
import ZIPFoundation

struct Project: Identifiable {
    var id: Int
    var js: JavaScript
}

class RunningProject: ObservableObject {
    @Published var project: Project?
    static var instance: RunningProject?
    static var id = 1
    
    init(){
        RunningProject.instance = self
    }
    
    func setRunningProject(js: JavaScript){
        self.project = Project(id: RunningProject.id, js: js)
        RunningProject.id += 1;
    }
}

extension Color {
    init(hex: Int, opacity: Double = 1.0) {
        let red = Double((hex & 0xff0000) >> 16) / 255.0
        let green = Double((hex & 0xff00) >> 8) / 255.0
        let blue = Double((hex & 0xff) >> 0) / 255.0
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: opacity)
    }
}

struct ContentView: View {
    @Environment(\.supportsMultipleWindows) private var supportsMultipleWindows
    @Environment(\.openWindow) private var openWindow
    @ObservedObject private var runningProject = RunningProject()
    @State private var otherWindow: Int? = nil
    let mainjs: JavaScript;
    
    init(){
        let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
        let documentDir = paths.first!
        
        let assetdir = Bundle.main.bundlePath + "/dist/webview"
        
        let entrypointContents = FileManager.default.contents(atPath: Bundle.main.bundlePath + "/dist/api/index.js")!
        
        self.mainjs = JavaScript(
            fsdir: documentDir,
            assetdir: assetdir,
            entrypointContents: String(data: entrypointContents, encoding: .utf8)!
        )
        self.mainjs.privileged = true
        
        self.mainjs.ctx["jsDirectory"] = Bundle.main.bundlePath + "/js"
        
        let resolvePath: @convention (block) (String) -> String = { entrypoint in
            return documentDir + "/" + entrypoint
        }
        self.mainjs.ctx["resolvePath"] = resolvePath
        
        let run: @convention (block) (String, String, String) -> Void = { projectdir, assetdir, entrypoint in
            let entrypointPath = documentDir + "/" + entrypoint
            let entrypointPtr = UnsafeMutablePointer<Int8>(mutating: (entrypointPath as NSString).utf8String)
            let entrypointContents = String.init(cString: buildAPI(entrypointPtr)!, encoding: .utf8)!
            RunningProject.instance?.setRunningProject(js: JavaScript(
                fsdir: documentDir + "/" + projectdir,
                assetdir: assetdir,
                entrypointContents: entrypointContents
            ))
        }
        self.mainjs.ctx["run"] = run
        
        let buildWebviewSwift: @convention (block) (String, String) -> Void = { entrypoint, outdir in
            let entrypointPtr = UnsafeMutablePointer<Int8>(mutating: (resolvePath(entrypoint) as NSString).utf8String)
            let outdirPtr = UnsafeMutablePointer<Int8>(mutating: (resolvePath(outdir) as NSString).utf8String)
            buildWebview(entrypointPtr, outdirPtr)
        }
        self.mainjs.ctx["buildWebview"] = buildWebviewSwift
        
        
        let zip: @convention (block) (String, [String], String) -> Void = { projectdir, items, to in
            let realpathTo = resolvePath(to);
            
            if FileManager.default.fileExists(atPath: realpathTo) {
                try! FileManager.default.removeItem(atPath: realpathTo)
            }
            
            let realpathToURL = URL(fileURLWithPath: realpathTo);
            let archive = try! Archive(url: realpathToURL, accessMode: .create)
            
            for item in items {
                let itemURL = URL(fileURLWithPath: resolvePath(projectdir + "/" + item))
                try! archive.addEntry(with: item, fileURL: itemURL)
            }
            
            let filesAppURL = URL(string: "shareddocuments://" + realpathTo)!
            UIApplication.shared.open(filesAppURL)
        }
        self.mainjs.ctx["zip"] = zip
        
        let unzip: @convention (block) (String, [UInt8]) -> Void = { to, zipData in
            let data = Data(zipData)
            let tmpURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("zip")
            try! data.write(to: tmpURL)
            try! FileManager.default.unzipItem(at: tmpURL, to: URL(fileURLWithPath: resolvePath(to)))
            try! FileManager.default.removeItem(at: tmpURL)
        }
        self.mainjs.ctx["unzip"] = unzip
    }

    
    var body: some View {
        ZStack {
            WebView(js: self.mainjs)
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .edgesIgnoringSafeArea(.all)
                .ignoresSafeArea()
                .overlay(alignment: .top) {
                    Color(hex: 0x1e293b)
                        .ignoresSafeArea(edges: .top)
                        .frame(height: 0)
                }
            if self.runningProject.project != nil && self.otherWindow != self.runningProject.project?.id {
                VStack {
                    HStack {
                        
                        Button {
                            self.runningProject.project = nil
                        } label: {
                            Image(systemName: "xmark")
                        }
                        .keyboardShortcut("w", modifiers: .command)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(EdgeInsets(top: 5, leading: 10, bottom: 3, trailing: 10))
                        
                        if self.supportsMultipleWindows {
                            Button {
                                openWindow(id: "running-app")
                                self.otherWindow = self.runningProject.project?.id
                            } label : {
                                Image(systemName: "rectangle.split.2x1.fill")
                            }
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .padding(EdgeInsets(top: 5, leading: 10, bottom: 3, trailing: 10))
                        }
                        
                    }
            
                    WebView(js: self.runningProject.project!.js)
                        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                        .edgesIgnoringSafeArea(.all)
                        .ignoresSafeArea()
                }
                .background(Color.black)
            }
                
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
    let js: JavaScript;
    var wkWebView: WKWebView?;
    
    init(js: JavaScript) {
        self.js = js
        
        let wkConfig = WKWebViewConfiguration()
        wkConfig.setURLSchemeHandler(RequestHandler(js: self.js),  forURLScheme: "fs")
        self.wkWebView = FullScreenWKWebView(frame: CGRect(x: 0, y: 0, width: 100, height: 100), configuration: wkConfig)
        if #available(iOS 16.4, *) {
            self.wkWebView!.isInspectable = true
        }
    }
    
    func makeUIView(context: Context) -> WKWebView  {
        let request = URLRequest(url: URL(string: "fs://localhost")!)
        self.wkWebView!.load(request)
        return self.wkWebView!
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
