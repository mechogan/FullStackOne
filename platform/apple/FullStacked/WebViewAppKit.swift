//
//  ViewRepresentable.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-11-27.
//
import SwiftUI
import WebKit

class WebViewExtended: WKWebView {
    func openBrowserURL(_ url: URL){
        NSWorkspace.shared.open(url)
    }
    
    func openDownloadDirectory(){
        NSWorkspace.shared.open(URL(fileURLWithPath: downloadDirectory))
    }
}

struct WebViewRepresentable: NSViewRepresentable {
    private let projectId: String;
    init(webView: WebView) {
        self.projectId = webView.requestHandler.instance.id
    }
    
    func makeNSView(context: Context) -> WebView  {
        return (WebViews.singleton?.getView(projectId: self.projectId))!
    }
    
    func updateNSView(_ uiView: WebView, context: Context) {
        
    }
}
