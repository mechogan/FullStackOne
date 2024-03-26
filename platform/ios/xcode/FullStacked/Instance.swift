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

class FullScreenWKWebView: WKWebView, WKNavigationDelegate {
    override init(frame: CGRect, configuration: WKWebViewConfiguration) {
        super.init(frame: frame, configuration: configuration)
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
    let title: String
}

struct InstanceRepresentable: UIViewRepresentable {
    let id = UUID()
    var inWindow: Bool = false
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
    var webview: FullScreenWKWebView
    let adapter: Adapter
    
    init(project: Project){
        self.adapter = Adapter(baseDirectory: project.location)
        let wkWebViewConfig = WKWebViewConfiguration()
        wkWebViewConfig.setURLSchemeHandler(RequestListener(adapter: self.adapter), forURLScheme: "fs")
        self.webview = FullScreenWKWebView(frame: CGRect(), configuration: wkWebViewConfig)
    }
    
    init(adapter: Adapter) {
        self.adapter = adapter
        let wkWebViewConfig = WKWebViewConfiguration()
        wkWebViewConfig.setURLSchemeHandler(RequestListener(adapter: self.adapter), forURLScheme: "fs")
        self.webview = FullScreenWKWebView(frame: CGRect(), configuration: wkWebViewConfig)
    }
    
    func push(messageType: String, message: String) {
        self.webview.evaluateJavaScript("window.push(`\(messageType)`, `\(message.replacingOccurrences(of: "\\", with: "\\\\"))`)")
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
                    "Content-Length": String(response.data.count)
                ]
            )!
            
            urlSchemeTask.didReceive(responseHTTP)
            urlSchemeTask.didReceive(response.data)
            urlSchemeTask.didFinish()
        }
        
        var pathname = request.url!.pathComponents.joined(separator: "/")
        
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
        
        self.adapter.callAdapterMethod(methodPath: pathname.split(separator: "/"), body: request.httpBody ?? Data(), done: { maybeResponseData in
            if(maybeResponseData is Void){
                response = Response(
                    data: Data(),
                    status: 200,
                    mimeType: "text/plain"
                )
            } else if (maybeResponseData is Bool) {
                response = Response(
                    data: ((maybeResponseData as! Bool) ? "1" : "0").data(using: .utf8)!,
                    status: 200,
                    mimeType: "application/json"
                )
            } else if(maybeResponseData is String) {
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
            } else if(maybeResponseData is AdapterError) {
                response = Response(
                    data: try! JSONSerialization.data(withJSONObject: (maybeResponseData as! AdapterError).toJSON),
                    status: 299,
                    mimeType: "application/json"
                )
            } else if(maybeResponseData is JSON) {
                response = Response(
                    data: try! (maybeResponseData as! JSON).rawData(),
                    status: 200,
                    mimeType: "application/json"
                )
            } else if(maybeResponseData != nil) {
                response = Response(
                    data: try! JSONSerialization.data(withJSONObject: maybeResponseData!),
                    status: 200,
                    mimeType: "application/json"
                )
            }
            
            send()
        })
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {

    }
}
