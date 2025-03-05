//
//  ViewRepresentable.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-11-27.
//
import SwiftUI
@preconcurrency import WebKit

// MacOS

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
        openPanel.allowsMultipleSelection = parameters.allowsMultipleSelection
        openPanel.begin { (result) in
            if result == NSApplication.ModalResponse.OK {
                completionHandler(openPanel.urls)
            } else if result == NSApplication.ModalResponse.cancel {
                completionHandler(nil)
            }
        }
    }
}

// suppress "funk" noise
// source: https://stackoverflow.com/a/69858444
class KeyView: NSView {
    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {}
}

struct WebViewRepresentable: NSViewRepresentable {
    private let webview: WebView;
    init(webView: WebView) {
        self.webview = webView
    }
    
    func makeNSView(context: Context) -> NSView  {
        let view = KeyView()
        DispatchQueue.main.async {
            view.window?.makeFirstResponder(view)
        }
        self.webview.autoresizingMask = [.width, .height]
        view.addSubview(self.webview);
        return view
    }
    
    
    func updateNSView(_ uiView: NSView, context: Context) {
        print("ici")
    }
}
