import SwiftUI
import WebKit

extension Color {
    init(hex: Int, opacity: Double = 1.0) {
        let red = Double((hex & 0xff0000) >> 16) / 255.0
        let green = Double((hex & 0xff00) >> 8) / 255.0
        let blue = Double((hex & 0xff) >> 0) / 255.0
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: opacity)
    }
}

func setDirectories(){
    let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
    let root = paths.first!
    let config = root + "/.config"
    let editor = Bundle.main.path(forResource: "editor", ofType: nil)!
    
    directories(
        root.ptr(),
        config.ptr(),
        editor.ptr()
    )
}

func CallbackC(projectIdPtr: UnsafeMutablePointer<Int8>, messageTypePtr: UnsafeMutablePointer<Int8>, messagePtr: UnsafeMutablePointer<Int8>) {
    let projectId = String(cString: projectIdPtr)
    let messageType = String(cString: messageTypePtr)
    let message = String(cString: messagePtr)
    
    if(projectId == "*") {
        FullStackedApp.singleton?.webViews.getEditor().onMessage(messageType: messageType, message: message)
        FullStackedApp.singleton?.webViews.views.forEach({$0.onMessage(messageType: messageType, message: message)})
    } else if(projectId == "") {
        if(messageType == "open") {
            FullStackedApp.singleton?.webViews.addWebView(projectId: message)
        } else if(FullStackedApp.singleton!.webViews.ready) {
            FullStackedApp.singleton?.webViews.getEditor().onMessage(messageType: messageType, message: message)
        }
    } else if let webview = FullStackedApp.singleton?.webViews.getView(projectId: projectId) {
        webview.onMessage(messageType: messageType, message: message)
    }
}

func setCallback(){
    let cb: @convention(c) (UnsafeMutablePointer<Int8>,UnsafeMutablePointer<Int8>,UnsafeMutablePointer<Int8>) -> Void = CallbackC
    let cbPtr = unsafeBitCast(cb, to: UnsafeMutableRawPointer.self)
    callback(cbPtr)
}


class WebViews: ObservableObject {
    @Published var views: [WebView] = []
    @Published var hiddenProjectsIds: [String] = []
    var ready = false
    private var editor: WebView?
    
    func getEditor() -> WebView {
        if(self.editor == nil) {
            self.editor = WebView(instance: Instance(projectId: "", isEditor: true))
        }
        return self.editor!
    }
    
    func addWebView(projectId: String) {
        if let existingWebView = self.getView(projectId: projectId) {
            existingWebView.reload()
        } else {
            let webView = WebView(instance: Instance(projectId: projectId))
            self.views.append(webView)
        }
    }
    
    func getView(projectId: String?) -> WebView? {
        if let view = self.views.first(where: {$0.requestHandler.instance.id == projectId}) {
            return view
        }
        
        return nil
    }
    
    func removeView(projectId: String?) {
        if let viewIndex = self.views.firstIndex(where: { $0.requestHandler.instance.id == projectId }) {
            let view = self.views.remove(at: viewIndex)
            view.close()
        }
        
        self.hiddenProjectsIds.removeAll(where: {$0 == projectId})
    }
    
    func setHidden(projectId: String) {
        self.hiddenProjectsIds.append(projectId)
    }
    
    func isHidden(_ projectId: String) -> Bool {
        return self.hiddenProjectsIds.first(where: { $0 == projectId }) != nil
    }
}



struct WebViewSingle: View {
    @Environment(\.dismiss) private var dismiss
    
    let projectId: String?
    let webView: WebView?
    
    init(projectId: String?) {
        self.projectId = projectId
        self.webView = FullStackedApp.singleton?.webViews.getView(projectId: projectId)
    }
    
    var body: some View {
        HStack {
            if(webView != nil) {
                WebViewRepresentable(webView: webView!)
                    .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                    .edgesIgnoringSafeArea(.all)
                    .ignoresSafeArea()
            }
        }
        .onAppear{
            if(self.projectId == nil || self.webView == nil) {
                self.dismiss()
            }
        }
        .onDisappear {
            FullStackedApp.singleton?.webViews.removeView(projectId: projectId)
        }
        
    }
}

struct WebViewEditor: View {
    var webView: WebView;
    
    var body: some View {
        WebViewRepresentable(webView: self.webView)
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
            .edgesIgnoringSafeArea(.all)
            .ignoresSafeArea()
            .onOpenURL{ url in
                self.webView.onMessage(messageType: "deeplink", message: url.absoluteString)
            }
    }
}

#if os(macOS)
let isMacOS = true
#else
let isMacOS = false
#endif


@available(iOS 16.0, *)
struct WebViewsStacked: View {
    @ObservedObject var webViews: WebViews;
    
    @Environment(\.supportsMultipleWindows) public var supportsMultipleWindows
    @Environment(\.openWindow) private var openWindow

    init(webViews: WebViews) {
        self.webViews = webViews
        self.webViews.ready = true
    }
    
    var body: some View {
        ZStack {
            WebViewEditor(webView: self.webViews.getEditor())
            ForEach(self.webViews.views.indices, id: \.self) { webViewIndex in
                VStack(spacing: 0) {
                    HStack(alignment: .center) {
                        if(supportsMultipleWindows) {
                            Button {
                                let projectId = self.webViews.views[webViewIndex].requestHandler.instance.id
                                self.openWindow(id: "window-webview", value: projectId)
                                FullStackedApp.singleton?.webViews.setHidden(projectId: projectId)
                            } label: {
                                Image(systemName: "square.fill.on.square.fill")
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(EdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10))
                        }
                        
                        Button {
                            let projectId = self.webViews.views[webViewIndex].requestHandler.instance.id
                            self.webViews.removeView(projectId: projectId)
                        } label: {
                            Image(systemName: "xmark")
                        }
                        .keyboardShortcut("w", modifiers: .command)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(EdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10))
                    }
                    
                    WebViewRepresentable(webView: self.webViews.views[webViewIndex])
                        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                        .edgesIgnoringSafeArea(.all)
                        .ignoresSafeArea()
                        .onAppear() {
                            if(isMacOS) {
                                let projectId = self.webViews.views[webViewIndex].requestHandler.instance.id
                                self.openWindow(id: "window-webview", value: projectId)
                            }
                        }
                }
                .background(Color.black)
                .opacity(isMacOS || FullStackedApp.singleton!.webViews.isHidden(self.webViews.views[webViewIndex].requestHandler.instance.id) ? 0 : 1)
            }
        }
        .background(Color(hex: 0x1e293b))
    }
}

struct WebViewsStackedLegacy: View {
    @ObservedObject var webViews: WebViews;
    
    init(webViews: WebViews) {
        self.webViews = webViews
        self.webViews.ready = true
    }
    
    var body: some View {
        ZStack {
            WebViewEditor(webView: self.webViews.getEditor())
            ForEach(self.webViews.views.indices, id: \.self) { webViewIndex in
                VStack(spacing: 0) {
                    HStack(alignment: .center) {
                        Button {
                            let projectId = self.webViews.views[webViewIndex].requestHandler.instance.id
                            self.webViews.removeView(projectId: projectId)
                        } label: {
                            Image(systemName: "xmark")
                        }
                        .keyboardShortcut("w", modifiers: .command)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(EdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10))
                    }
                    
                    WebViewRepresentable(webView: self.webViews.views[webViewIndex])
                        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                        .edgesIgnoringSafeArea(.all)
                        .ignoresSafeArea()
                }
                .background(Color.black)
            }
        }
        .background(Color(hex: 0x1e293b))
    }
}

extension String {
    func ptr() -> UnsafeMutablePointer<Int8> {
        return UnsafeMutablePointer<Int8>(mutating: (self as NSString).utf8String!)
    }
}
