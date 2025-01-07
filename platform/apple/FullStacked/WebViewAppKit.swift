//
//  ViewRepresentable.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-11-27.
//
import SwiftUI
@preconcurrency import WebKit

class WebViewExtended: WKWebView, WKUIDelegate {
    override init(frame: CGRect, configuration: WKWebViewConfiguration){
        super.init(frame: frame, configuration: configuration)
        self.uiDelegate = self
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    func openBrowserURL(_ url: URL){
        NSWorkspace.shared.open(url)
    }
    
    func openDownloadDirectory(){
        NSWorkspace.shared.open(URL(fileURLWithPath: downloadDirectory))
    }
    
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let openPanel = NSOpenPanel()
        openPanel.canChooseFiles = true
        openPanel.begin { (result) in
            if result == NSApplication.ModalResponse.OK {
                if let url = openPanel.url {
                    completionHandler([url])
                }
            } else if result == NSApplication.ModalResponse.cancel {
                completionHandler(nil)
            }
        }
    }
}

struct WebViewRepresentable: NSViewRepresentable {
    private let webview: WebView;
    init(webView: WebView) {
        self.webview = webView
    }
    
    func makeNSView(context: Context) -> WebView  {
        return self.webview
    }
    
    func updateNSView(_ uiView: WebView, context: Context) {
        
    }
}
