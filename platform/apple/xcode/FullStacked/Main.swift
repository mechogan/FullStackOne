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
//
//    // MIGRATION 2024-11-06 - 0.9.0 to 0.10.0
//
//    let oldConfigDir = config + "/fullstacked"
//    if(FileManager.default.fileExists(atPath: oldConfigDir)) {
//        let items = try! FileManager.default.contentsOfDirectory(atPath: oldConfigDir)
//        items.filter({!$0.contains("node_modules")}).forEach({ item in
//            let oldPathUrl = URL(fileURLWithPath: oldConfigDir + "/" + item)
//            let newPathUrl = URL(fileURLWithPath: config + "/" + item)
//            if(FileManager.default.fileExists(atPath: config + "/" + item)) {
//                try! FileManager.default.removeItem(at: newPathUrl)
//            }
//            try! FileManager.default.copyItem(at: oldPathUrl, to: newPathUrl)
//        })
//    }
//    
//    // end migration
    
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
    
    if(projectId == "" && messageType == "open") {
        WebViews.singleton?.addWebView(webView: WebView(instance: Instance(projectId: message)))
        return
    }
    
    if let webview = WebViews.singleton?.getView(projectId: projectId) {
        webview.onMessage(messageType: messageType, message: message)
    }
}

func setCallback(){
    let cb: @convention(c) (UnsafeMutablePointer<Int8>,UnsafeMutablePointer<Int8>,UnsafeMutablePointer<Int8>) -> Void = CallbackC
    let cbPtr = unsafeBitCast(cb, to: UnsafeMutableRawPointer.self)
    callback(cbPtr)
}


class WebViews: ObservableObject {
    static var singleton: WebViews?
    @Published var views: [WebView] = []
    init() {
        WebViews.singleton = self;
    }
    func addWebView(webView: WebView) {
        self.views.append(webView)
    }
    func getView(projectId: String) -> WebView? {
        if let view = self.views.first(where: {$0.requestHandler.instance.id == projectId}) {
            return view
        }
        
        return nil
    }
    func removeView(projectId: String) {
        if let viewIndex = self.views.firstIndex(where: { $0.requestHandler.instance.id == projectId }) {
            let view = self.views.remove(at: viewIndex)
            view.close()
        }
    }
}

struct Main: View {
    @ObservedObject var webViews = WebViews()
    
    init(){
        setDirectories()
        setCallback()
        
        self.webViews.addWebView(webView: WebView(instance: Instance(projectId: "", isEditor: true)))
    }
    
    var body: some View {
        ZStack {
            ForEach(self.webViews.views.indices, id: \.self) { webViewIndex in
                
                if self.webViews.views[webViewIndex].requestHandler.instance.isEditor {
                    WebViewRepresentable(webView: self.webViews.views[webViewIndex])
                        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                        .edgesIgnoringSafeArea(.all)
                        .ignoresSafeArea()
                        .onOpenURL{ url in
                            self.webViews.views[webViewIndex].onMessage(messageType: "deeplink", message: url.absoluteString)
                        }
                } else {
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
        }
        .background(Color(hex: 0x1e293b))
    }
}

extension String {
    func ptr() -> UnsafeMutablePointer<Int8> {
        return UnsafeMutablePointer<Int8>(mutating: (self as NSString).utf8String!)
    }
}
