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
    let nodeModules = root + "/node_modules"
    let editor = Bundle.main.path(forResource: "build", ofType: nil)!
    
    // MIGRATION 2024-11-06 - 0.9.0 to 0.10.0

    let oldConfigDir = config + "/fullstacked"
    if(FileManager.default.fileExists(atPath: oldConfigDir)) {
        let items = try! FileManager.default.contentsOfDirectory(atPath: oldConfigDir)
        items.filter({!$0.contains("node_modules")}).forEach({ item in
            let oldPathUrl = URL(fileURLWithPath: oldConfigDir + "/" + item)
            let newPathUrl = URL(fileURLWithPath: config + "/" + item)
            if(FileManager.default.fileExists(atPath: config + "/" + item)) {
                try! FileManager.default.removeItem(at: newPathUrl)
            }
            try! FileManager.default.copyItem(at: oldPathUrl, to: newPathUrl)
        })
    }
    
    // end migration
    
    directories(
        root.ptr(),
        config.ptr(),
        nodeModules.ptr(),
        editor.ptr()
    )
}

struct Main: View {
    init(){
        setDirectories()
    }
    
    var body: some View {
        WebViewRepresentable(instance: Instance(projectId: "", isEditor: true))
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
            .edgesIgnoringSafeArea(.all)
            .ignoresSafeArea()
    }
}

struct WebViewRepresentable: UIViewRepresentable {
    private let webView: WebView
    
    init(instance: Instance) {
        self.webView = WebView(instance: instance)
    }
    
    func makeUIView(context: Context) -> WebView  {
        return self.webView
    }
    
    func updateUIView(_ uiView: WebView, context: Context) {
        
    }
}

extension String {
    func ptr() -> UnsafeMutablePointer<Int8> {
        return UnsafeMutablePointer<Int8>(mutating: (self as NSString).utf8String!)
    }
}
