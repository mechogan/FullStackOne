//
//  ViewRepresentable.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-11-27.
//
import SwiftUI

struct WebViewRepresentable: UIViewRepresentable {
    private let projectId: String;
    init(webView: WebView) {
        self.projectId = webView.requestHandler.instance.id
    }
    
    func makeUIView(context: Context) -> WebView  {
        return (WebViews.singleton?.getView(projectId: self.projectId))!
    }
    
    func updateUIView(_ uiView: WebView, context: Context) {
        
    }
}
