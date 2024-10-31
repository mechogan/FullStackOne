//
//  Instance.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-03-22.
//

import Foundation
import WebKit
import SwiftUI
import SwiftyJSON

class FullScreenWKWebView: WKWebView, WKNavigationDelegate, WKScriptMessageHandler {
    var didLoad: (() -> Void)?
    var logFn: ((_ log: String) -> Void)?
    
    init(adapter: Adapter, overrideLogging: Bool = true) {
        let wkWebViewConfig = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        wkWebViewConfig.userContentController = userContentController
        wkWebViewConfig.setURLSchemeHandler(RequestListener(adapter: adapter), forURLScheme: "fs")
        
        super.init(frame: CGRect(), configuration: wkWebViewConfig)
        
        if(overrideLogging) {
            userContentController.add(self, name: "logging")
            userContentController.addUserScript(WKUserScript(source: overrideConsole, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        
        self.navigationDelegate = self
        
        if #available(iOS 16.4, *) {
            self.isInspectable = true
        }
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override var safeAreaInsets: UIEdgeInsets {
        return UIEdgeInsets(top: super.safeAreaInsets.top, left: 0, bottom: 0, right: 0)
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
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if(self.logFn == nil){
            print(message.body as! String)
        } else {
            self.logFn!(message.body as! String)
        }
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if(self.didLoad == nil) {
            return;
        }
        self.didLoad!()
        self.didLoad = nil;
    }
}

struct Response {
    var data: Data
    var status: Int
    var mimeType: String
}

let notFound = Response(
    data: "Not Found".data(using: .utf8)!,
    status: 404,
    mimeType: "text/plain"
)

struct Project {
    let location: String
    let id: String
    let title: String
}

struct InstanceRepresentable: UIViewRepresentable {
    let instance: Instance
    
    init(instance: Instance) {
        self.instance = instance
    }
    
    func makeUIView(context: Context) -> FullScreenWKWebView  {
        let request = URLRequest(url: URL(string: "fs://localhost")!)
        self.instance.webview.load(request)
        return self.instance.webview
    }
    
    func updateUIView(_ uiView: FullScreenWKWebView, context: Context) {
        self.instance.webview = uiView
    }
}

class Instance  {
    let id = UUID()
    var webview: FullScreenWKWebView
    let adapter: Adapter
    
    init(project: Project){
        self.adapter = Adapter(projectId: project.id, baseDirectory: project.location)
        self.webview = FullScreenWKWebView(adapter: self.adapter)
    }
    
    init(adapter: Adapter) {
        self.adapter = adapter
        self.webview = FullScreenWKWebView(adapter: self.adapter, overrideLogging: false)
    }
    
    deinit {
        self.webview.configuration.userContentController.removeAllScriptMessageHandlers()
    }
    
    func push(messageType: String, message: String) {
        DispatchQueue.main.async {
            self.webview.evaluateJavaScript("window.push(`\(messageType)`, `\(message.replacingOccurrences(of: "\\", with: "\\\\"))`)")
        }
    }
}

class RequestListener: NSObject, WKURLSchemeHandler {
    let adapter: Adapter;
    
    init(adapter: Adapter) {
        self.adapter = adapter
    }
    
    // Request Handler
    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let request = urlSchemeTask.request
        
        var response = Response(
            data: notFound.data,
            status: notFound.status,
            mimeType: notFound.mimeType
        )
        
        let send = {
            let responseHTTP = HTTPURLResponse(
                url: request.url!,
                statusCode: response.status,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": response.mimeType,
                    "Content-Length": String(response.data.count),
                    "Cache-Control": "no-cache"
                ]
            )!
            
            urlSchemeTask.didReceive(responseHTTP)
            urlSchemeTask.didReceive(response.data)
            urlSchemeTask.didFinish()
        }
        
        var pathname = request.url!.pathComponents.filter({$0 != "/"}).joined(separator: "/")
        
        // remove trailing slash
        if(pathname.hasSuffix("/")) {
            pathname = String(pathname.dropLast())
        }
        
        // remove leading slash
        if(pathname.hasPrefix("/")) {
            pathname = String(pathname.dropFirst())
        }
        
        // check for [path]/index.html
        let maybeIndexHTML = pathname + "/index.html";
        let indexHTMLExists = self.adapter.fs.exists(path: maybeIndexHTML)
        if (indexHTMLExists != nil && (indexHTMLExists as! Dictionary<String, Bool>)["isFile"]!) {
            pathname = maybeIndexHTML
        }
        
        // we'll check for a built file
        if (
            pathname.hasSuffix(".js") ||
            pathname.hasSuffix(".css") ||
            pathname.hasSuffix(".map")
        ) {
            let maybeBuiltFile = ".build/" + pathname;
            let builtFileExists = self.adapter.fs.exists(path: maybeBuiltFile)
            if (builtFileExists != nil && (builtFileExists as! Dictionary<String, Bool>)["isFile"]!) {
                pathname = maybeBuiltFile
            }
        }
        
        let fileExists = self.adapter.fs.exists(path: pathname)
        if (fileExists != nil && (fileExists as! Dictionary<String, Bool>)["isFile"]!) {
            response.data = self.adapter.fs.readFile(path: pathname, utf8: false) as! Data
            response.mimeType = AdapterFS.mimeType(filePath: pathname)
            response.status = 200
            return send()
        }
        
        var args: [Any?]? = nil;
        
        if(request.httpMethod == "GET") {
            let uri = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
            let bodyStr = uri?.queryItems?.first(where: {$0.name == "body"})?.value
            if(bodyStr != nil){
                args = JSON(parseJSON: (bodyStr?.removingPercentEncoding)!).arrayValue.map{e in
                    switch(e.type){
                    case .string:
                        return e.stringValue
                    case .number:
                        return e.numberValue
                    default:
                        return e
                    }
                }
            }
        }
        
        if(args == nil) {
            args = deserializeArgs(data: request.httpBody!)
        }
        
        self.adapter.callAdapterMethod(methodPath: pathname.split(separator: "/"), args: args ?? [], done: { maybeResponseData in
            
            if(maybeResponseData is String) {
                response = Response(
                    data: (maybeResponseData as! String).data(using: .utf8)!,
                    status: 200,
                    mimeType: "text/plain"
                )
            } else if(maybeResponseData is Data) {
                response = Response(
                    data: maybeResponseData as! Data,
                    status: 200,
                    mimeType: "application/octet-stream"
                )
            } else if(maybeResponseData is Void){
                response = Response(
                    data: Data(),
                    status: 200,
                    mimeType: "text/plain"
                )
            } else if(maybeResponseData is AdapterError) {
                response = Response(
                    data: try! JSONSerialization.data(withJSONObject: (maybeResponseData as! AdapterError).toJSON),
                    status: 299,
                    mimeType: "application/json"
                )
            } else if(
                maybeResponseData is JSON ||
                maybeResponseData is Bool ||
                maybeResponseData is Int ||
                maybeResponseData != nil
            ) {
                
                let responseData = maybeResponseData is JSON
                ? try! (maybeResponseData as! JSON).rawData()
                : maybeResponseData is Bool
                ? ((maybeResponseData as! Bool) ? "true" : "false").data(using: .utf8)!
                : maybeResponseData is Int
                ? String(maybeResponseData as! Int).data(using: .utf8)!
                : try! JSONSerialization.data(withJSONObject: maybeResponseData!)
                
                response = Response(
                    data: responseData,
                    status: 200,
                    mimeType: "application/json"
                )
            }
            
            send()
        })
    }
    
    private func bytesToNumber(bytes: [UInt8]) -> UInt {
        var value : UInt = 0
        for byte in bytes {
            value = value << 8
            value = value | UInt(byte)
        }
        return value
    }
    
    private func deserializeNumber(bytes: [UInt8]) -> Int {
        let negative = bytes[0] == 1;
        
        var n: UInt = 0, i = 1;
        while (i <= bytes.count) {
            n += UInt(bytes[i]) << ((i - 1) * 8)
            i += 1
        }
        
        let value = Int(n);
        
        return negative ? 0 - value : value;
    }
    
    private func deserializeArgs(data: Data) -> [Any?] {
        var args: [Any?] = [];
        
        var cursor = 0;
        while(cursor < data.count) {
            let type = DataType(rawValue: data[cursor])
            cursor += 1
            let length = Int(self.bytesToNumber(bytes: [UInt8](data[cursor...(cursor + 3)])))
            cursor += 4;
            let arg = length > 0 ? data[cursor...(cursor + length - 1)] : Data()
            cursor += length
            
            switch (type) {
            case .UNDEFINED:
                args.append(nil)
                break
            case .BOOLEAN:
                args.append(arg[0] == 1 ? true : false)
                break
            case .STRING:
                args.append(String(data: arg, encoding: .utf8))
                break
            case .NUMBER:
                args.append(self.deserializeNumber(bytes: [UInt8](arg)));
                break
            case .JSON:
                try! args.append(JSON(data: arg))
                break
            case .UINT8ARRAY:
                args.append(arg)
                break
            case .none:
                print("Unknown type to deserialize")
            }
        }
        
        return args;
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        
    }
}

enum DataType: UInt8 {
    case UNDEFINED = 0
    case BOOLEAN = 1
    case STRING = 2
    case NUMBER = 3
    case JSON = 4
    case UINT8ARRAY = 5
}

// source: https://stackoverflow.com/a/61489361
let overrideConsole = """
    function log(type, args) {
        const logStr = `${type ? type + ": " : ""}${Object.values(args)
          .map(v => typeof(v) === "undefined" ? "undefined" : typeof(v) === "object" ? JSON.stringify(v, null, 2) : v.toString())
          .map(v => v.substring(0, 3000)) // Limit msg to 3000 chars
          .join(", ")}`

        tryToMap(logStr).then(str => window.webkit.messageHandlers.logging.postMessage(str));
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

    async function tryToMap(str){
        const itemsToMap = str?.match(/\\b([0-z]*@)?[0-z]*:\\/\\/.*:\\d+:\\d+\\b/g)
        
        if(!itemsToMap?.length) return str;

        for(const item of itemsToMap) {
            str = str.replace(item, await mapFunction(item) + ` (${item})`);
        }
        return str;
    }

    async function getSourceMap(file){
        if(!sourceMaps[file]){
            sourceMaps[file] = new window.sourceMapConsumer(await (await fetch(file + ".map")).json())
        }
        return sourceMaps[file];
    }

    async function mapLocation(location) {
        const [file, ln, col] = location.slice("fs://localhost/".length).split(":");

        const sourceMap = await getSourceMap(file);
        const mappedPosition = sourceMap.originalPositionFor({
          line: parseInt(ln),
          column: parseInt(col)
        })

        const originalFile = mappedPosition.source.split("/").filter(part => part !== "..").join("/");

        return originalFile + ":" + mappedPosition.line + ":" + mappedPosition.column;
    }

    async function mapFunction(line) {
        let [fn, location] = line.split("@");

        if(!location)
            return mapLocation(fn);

        const [file, ln, col] = location.slice("fs://localhost/".length).split(":");

        const sourceMap = await getSourceMap(file);
        const mappedPosition = sourceMap.originalPositionFor({
          line: parseInt(ln),
          column: parseInt(col)
        })

        const name = mappedPosition?.name?.trim()
            ? mappedPosition.name + "@"
            : fn.trim()
                ? fn + "@"
                : "";

        const originalFile = mappedPosition.source.split("/").filter(part => part !== "..").join("/");

        return name + originalFile + ":" + mappedPosition.line + ":" + mappedPosition.column;
    }

    window.addEventListener("unhandledrejection", (e) => {
        log("Unhandled Rejection", [`${e.reason.message} at ${e.reason.stack}`]);
    });
    window.addEventListener("error", function(e) {
       log("Uncaught", [`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`]);
    })
"""
