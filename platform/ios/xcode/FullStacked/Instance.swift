//
//  Instance.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-03-22.
//

import Foundation
import WebKit
import SwiftUI

class FullScreenWKWebView: WKWebView {
    override init(frame: CGRect, configuration: WKWebViewConfiguration) {
        super.init(frame: frame, configuration: configuration)
        
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
}

struct Response {
    var data: Data
    var status: Int
    var mimeType: String
}

struct Uint8ArrayJSON: Codable {
    let type = "Uint8Array"
    var data: [UInt8]
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
    let instance: Instance;
    
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
    var webview: FullScreenWKWebView;
    let adapter: Adapter;
    
    init(project: Project){
        self.adapter = Adapter(baseDirectory: project.location);
        let wkWebViewConfig = WKWebViewConfiguration()
        wkWebViewConfig.setURLSchemeHandler(RequestListener(adapter: self.adapter), forURLScheme: "fs");
        self.webview = FullScreenWKWebView(frame: CGRect(), configuration: wkWebViewConfig)
    }
    
    init(adapter: Adapter) {
        self.adapter = adapter
        let wkWebViewConfig = WKWebViewConfiguration()
        wkWebViewConfig.setURLSchemeHandler(RequestListener(adapter: self.adapter), forURLScheme: "fs");
        self.webview = FullScreenWKWebView(frame: CGRect(), configuration: wkWebViewConfig)
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
        let indexHTMLExists = self.adapter.fs.exists(path: maybeIndexHTML);
        if (indexHTMLExists != nil && (indexHTMLExists as! Dictionary<String, Bool>)["isFile"]!) {
            pathname = maybeIndexHTML
        }
        
        let fileExists = self.adapter.fs.exists(path: pathname)
        if (fileExists != nil && (fileExists as! Dictionary<String, Bool>)["isFile"]!) {
            response.data = self.adapter.fs.readFile(path: pathname, utf8: false) as! Data
            response.mimeType = AdapterFS.mimeType(filePath: pathname)
            response.status = 200
        } else {
            if let maybeResponseData = self.adapter.callAdapterMethod(methodPath: pathname.split(separator: "/"), body: request.httpBody ?? Data()) {
                if(maybeResponseData is String) {
                    response = Response(
                        data: (maybeResponseData as! String).data(using: .utf8)!,
                        status: 200,
                        mimeType: "text/plain"
                    )
                } else if(maybeResponseData is Data) {
                    response = Response(
                        data: try! JSONSerialization.data(withJSONObject: ["type": "Uint8Array", "data": [UInt8](maybeResponseData as! Data)]),
                        status: 200,
                        mimeType: "application/octet-stream"
                    )
                } else if(maybeResponseData is AdapterError) {
                    response = Response(
                        data: try! JSONSerialization.data(withJSONObject: (maybeResponseData as! AdapterError).toJSON),
                        status: 299,
                        mimeType: "application/json"
                    )
                } else {
                    response = Response(
                        data: try! JSONSerialization.data(withJSONObject: maybeResponseData),
                        status: 200,
                        mimeType: "application/json"
                    )
                }
            }
        }
        
        let responseHTTP = HTTPURLResponse(
            url: request.url!,
            statusCode: response.status,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": response.mimeType,
                "Content-Length": String(response.data.count)
            ]
        )!
        
        DispatchQueue.main.async {
            urlSchemeTask.didReceive(responseHTTP)
            urlSchemeTask.didReceive(response.data)
            urlSchemeTask.didFinish()
        }
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {

    }
}
