import SwiftUI
import WebKit
import JavaScriptCore
import ZIPFoundation
import SWCompression

struct Project: Identifiable {
    var id: Int
    var js: JavaScript
}

class RunningProject: ObservableObject {
    @Published var project: Project?
    @Published var jsLogs: String = ""
    static var instance: RunningProject?
    static var id = 1
    
    init(){
        RunningProject.instance = self
    }
    
    func setRunningProject(js: JavaScript){
        self.jsLogs = "";
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
    @State private var jsConsole: Bool = false
    static var instance: ContentView? = nil
    let mainjs: JavaScript
    
    init(){
        let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
        let documentDir = paths.first!
        
        let assetdir = Bundle.main.bundlePath + "/build/webview"
        
        let entrypointContents = FileManager.default.contents(atPath: Bundle.main.bundlePath + "/build/api/index.js")!
        
        self.mainjs = JavaScript(
            logFn: { messages in print(messages) },
            fsdir: documentDir,
            assetdir: assetdir,
            entrypointContents: String(data: entrypointContents, encoding: .utf8)!
        )
        self.mainjs.privileged = true
        
        self.mainjs.ctx["jsDirectory"] = Bundle.main.bundlePath + "/js"
        
        self.mainjs.ctx["demoZIP"] = Bundle.main.bundlePath + "/Demo.zip"
        
        let resolvePath: @convention (block) (String) -> String = { entrypoint in
            return documentDir + "/" + entrypoint
        }
        self.mainjs.ctx["resolvePath"] = resolvePath
        
        let run: @convention (block) (String, String, String, String, Bool) -> Void = { projectdir, assetdir, entrypoint, nodeModulesDir, hasErrors in
            let entrypointPath = documentDir + "/" + entrypoint
            let entrypointPtr = UnsafeMutablePointer<Int8>(mutating: (entrypointPath as NSString).utf8String)
            
            let nodeModuleDirPtr = UnsafeMutablePointer<Int8>(mutating: (nodeModulesDir as NSString).utf8String)
            
            var errorsPtr = UnsafeMutablePointer<Int8>(nil)
        
            let apiScriptPtr = buildAPI(entrypointPtr, nodeModuleDirPtr, &errorsPtr)
            
            if(errorsPtr != nil) {
                let errorsJSONStr = String.init(cString: errorsPtr!, encoding: .utf8)!
                ContentView.instance?.mainjs.push?("buildError", errorsJSONStr)
                return
            }
            
            if(hasErrors){
                return
            }
            
            let entrypointContents = String.init(cString: apiScriptPtr!, encoding: .utf8)!
            RunningProject.instance?.setRunningProject(js: JavaScript(
                logFn: {messages in ContentView.instance?.mainjs.push?("log", messages) },
                fsdir: documentDir + "/" + projectdir,
                assetdir: assetdir,
                entrypointContents: entrypointContents
            ))
        }
        self.mainjs.ctx["run"] = run
        
        let buildWebviewSwift: @convention (block) (String, String, String) -> Bool = { entrypoint, outfile, nodeModulesDir in
            let entrypointPtr = UnsafeMutablePointer<Int8>(mutating: (resolvePath(entrypoint) as NSString).utf8String)
            let outfilePtr = UnsafeMutablePointer<Int8>(mutating: (resolvePath(outfile) as NSString).utf8String)
            let nodeModulesDirPtr = UnsafeMutablePointer<Int8>(mutating: (nodeModulesDir as NSString).utf8String)
            
            var errorsPtr = UnsafeMutablePointer<Int8>(nil)
        
            buildWebview(entrypointPtr, outfilePtr, nodeModulesDirPtr, &errorsPtr)
            
            if(errorsPtr != nil) {
                let errorsJSONStr = String.init(cString: errorsPtr!, encoding: .utf8)!
                ContentView.instance?.mainjs.push?("buildError", errorsJSONStr)
                return false
            }
            
            return true
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
            let zipEntries = try! ZipContainer.open(container: data);
            zipEntries.forEach { zipEntry in
                let nameComponents = zipEntry.info.name.split(separator: "/")
                let directoryComponents = nameComponents.dropLast();
                
                let directory = directoryComponents.count > 0
                    ? resolvePath(to + "/" + String(directoryComponents.joined(separator: "/")))
                    : resolvePath(to)
                try! FileManager.default.createDirectory(at: URL(fileURLWithPath: directory), withIntermediateDirectories: true)
                
                let filename = resolvePath(to + "/" + String(nameComponents.joined(separator: "/")))
                try! zipEntry.data?.write(to: URL(fileURLWithPath: filename))
            }
        }
        self.mainjs.ctx["unzip"] = unzip
        
        let untar: @convention (block) (String, [UInt8]) -> Void = { to, tarData in
            let data = Data(tarData)
            let decompressedData = try! GzipArchive.unarchive(archive: data)
            let tarEntries = try! TarContainer.open(container: decompressedData)
            tarEntries.forEach { tarEntry in
                let nameComponents = tarEntry.info.name.split(separator: "/").dropFirst()
                let directoryComponents = nameComponents.dropLast();
                
                let directory = directoryComponents.count > 0
                    ? resolvePath(to + "/" + String(directoryComponents.joined(separator: "/")))
                    : resolvePath(to)
                try! FileManager.default.createDirectory(at: URL(fileURLWithPath: directory), withIntermediateDirectories: true)
                
                let filename = resolvePath(to + "/" + String(nameComponents.joined(separator: "/")))
                try! tarEntry.data?.write(to: URL(fileURLWithPath: filename))
            }
        }
        self.mainjs.ctx["untar"] = untar
        
        let checkEsbuild: @convention (block) () -> Bool = { 
            return true
        }
        self.mainjs.ctx["checkEsbuildInstall"] = checkEsbuild
        
        ContentView.instance = self
    }

    
    var body: some View {
        ZStack {
            Color(hex: 0x1e293b)
                .ignoresSafeArea()
            Image(uiImage: UIImage(named: "build/webview/assets/dev-icon.png")!)
                .resizable()
                .frame(width: 100, height: 100, alignment: .center)
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
                        .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                        
                        Button {
                            jsConsole = !jsConsole
                        } label: {
                            Image(systemName: "square.topthird.inset.filled")
                        }
                        .frame(maxWidth: .infinity, alignment: self.supportsMultipleWindows ? .center : .trailing)
                        .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                        
                        if self.supportsMultipleWindows {
                            Button {
                                openWindow(id: "running-app")
                                self.otherWindow = self.runningProject.project?.id
                            } label : {
                                Image(systemName: "rectangle.split.2x1.fill")
                            }
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                        }
                        
                    }
                    
                    ScrollView {
                        Text(self.runningProject.jsLogs)
                            .lineLimit(.max)
                            .font(.system(size: 10, design: .monospaced))
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                            .padding(EdgeInsets(top: 3, leading: 0, bottom: 0, trailing: 0))
                            .rotationEffect(.degrees(180.0))
                    }
                    .frame(maxWidth: .infinity, maxHeight: jsConsole ? 200 : 0)
                    .rotationEffect(.degrees(180.0))
                    
            
                    WebView(js: self.runningProject.project!.js)
                        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                        .edgesIgnoringSafeArea(.all)
                        .ignoresSafeArea()
                }
                .background(Color.black)
            }
        }
        .onOpenURL { launchURL in
            self.mainjs.processRequest(headers: [:], pathname: "launchURL", body: "[\"\(launchURL.absoluteString)\"]".data(using: .utf8), onCompletion: {_ in})
        }
    }
}

#Preview {
    ContentView()
}


class OpenLinkDelegate: NSObject, WKNavigationDelegate {
    let js: JavaScript;
    
    init(js: JavaScript) {
        self.js = js;
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        while(self.js.unsentMessages.count > 0) {
            let unsentMessage = self.js.unsentMessages.removeFirst();
            self.js.push?(unsentMessage.0, unsentMessage.1)
        }
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .linkActivated  {
            if let url = navigationAction.request.url, "localhost" != url.host, UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        } else {
            decisionHandler(.allow)
        }
    }

}
class FullScreenWKWebView: WKWebView {
    override var safeAreaInsets: UIEdgeInsets {
        return UIEdgeInsets(top: super.safeAreaInsets.top, left: 0, bottom: 0, right: 0)
    }
}

class LoggingMessageHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        RunningProject.instance?.jsLogs += "\n\n" + (message.body as! String)
    }
}

// source: https://stackoverflow.com/a/61489361
let overrideConsole = """
    function log(type, args) {
      window.webkit.messageHandlers.logging.postMessage(
        `${type ? type + ": " : ""}${Object.values(args)
          .map(v => typeof(v) === "undefined" ? "undefined" : typeof(v) === "object" ? JSON.stringify(v, null, 2) : v.toString())
          .map(v => v.substring(0, 3000)) // Limit msg to 3000 chars
          .join(", ")}`
      )
    }

    let originalLog = console.log
    let originalWarn = console.warn
    let originalError = console.error
    let originalDebug = console.debug

    console.log = function() { log("", arguments); originalLog.apply(null, arguments) }
    console.warn = function() { log("warn", arguments); originalWarn.apply(null, arguments) }
    console.error = function() { log("Error", arguments); originalError.apply(null, arguments) }
    console.debug = function() { log("debug", arguments); originalDebug.apply(null, arguments) }

    const sourceMaps = {};

    async function getSourceMap(file){
        if(!sourceMaps[file]){
            sourceMaps[file] = new window.sourceMapConsumer(await (await fetch(file + ".map")).json())
        }
        return sourceMaps[file];
    }

    async function sourceMapStack(stack) {
        const lines = stack.split("\\n");
        const mappedLines = [];
        for (const line of lines) {
            const [fn, location] = line.split("@");
            const [file, ln, col] = location.slice("fs://localhost/".length).split(":");

            const sourceMap = await getSourceMap(file);
            const mappedPosition = sourceMap.originalPositionFor({
              line: parseInt(ln),
              column: parseInt(col)
            })

            const name = mappedPosition.name
                ? mappedPosition.name + "@"
                : fn
                    ? fn + "@"
                    : "";
            const originalFile = mappedPosition.source.split("/").filter(part => part !== "..").join("/");

            mappedLines.push(name + originalFile + ":" + mappedPosition.line + ":" + mappedPosition.column);
        }
        return mappedLines.join("\\n");
    }

    window.addEventListener("unhandledrejection", (e) => {
        sourceMapStack(e.reason.stack).then(mappedStack => {
            log("Unhandled Rejection", [`${e.reason.message} at ${mappedStack}`])
        })
    });
    window.addEventListener("error", function(e) {
       log("Uncaught", [`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`])
    })
"""

struct WebView: UIViewRepresentable {
    let js: JavaScript;
    let navigationDelegate: OpenLinkDelegate;
    
    init(js: JavaScript) {
        self.js = js
        self.navigationDelegate = OpenLinkDelegate(js: js)
        
        let userContentController = WKUserContentController()
        userContentController.add(LoggingMessageHandler(), name: "logging")
        userContentController.addUserScript(WKUserScript(source: overrideConsole, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let wkConfig = WKWebViewConfiguration()
        wkConfig.setURLSchemeHandler(RequestHandler(js: self.js),  forURLScheme: "fs")
        wkConfig.userContentController = userContentController
        wkConfig.suppressesIncrementalRendering = true
        self.js.webview = FullScreenWKWebView(frame: CGRect(x: 0, y: 0, width: 100, height: 100), configuration: wkConfig)
        self.js.webview!.isOpaque = false
        self.js.webview!.navigationDelegate = self.navigationDelegate
        if #available(iOS 16.4, *) {
            self.js.webview!.isInspectable = true
        }
    }
    
    func makeUIView(context: Context) -> WKWebView  {
        let request = URLRequest(url: URL(string: "fs://localhost")!)
        self.js.webview!.load(request)
        return self.js.webview!
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        self.js.webview = uiView
        uiView.navigationDelegate = self.navigationDelegate
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
        
        self.js.processRequest(
            headers: headers,
            pathname: pathname,
            body: body,
            onCompletion: {jsResponse in
                let mimeType = jsResponse["mimeType"]!.toString()!
                
                let data = jsResponse.hasProperty("data")
                    ? Data(jsResponse["data"]!.toArray()! as! [UInt8])
                    : nil
                
                let responseBody = data != nil
                    ? data!
                    : nil
                
                let response = HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: "HTTP/1.1",
                    headerFields: responseBody != nil
                        ? [
                            "Content-Type": mimeType,
                            "Content-Length": String(responseBody!.count)
                        ]
                    : nil
                )!
                
                DispatchQueue.main.async {
                    urlSchemeTask.didReceive(response)
                    urlSchemeTask.didReceive(responseBody == nil ? Data() : responseBody!)
                    urlSchemeTask.didFinish()
                }
            }
        )
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        
    }
}
