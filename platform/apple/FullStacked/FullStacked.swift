import SwiftUI

@main
struct FullStackedApp: App {
    static var singleton: FullStackedApp?
    @ObservedObject var webViews = WebViews()

    init() {
        FullStackedApp.singleton = self;
        
        setCallback()
        setDirectories()
    }
    
    var body: some Scene {
        #if os(macOS)
        Window("FullStacked", id: "Editor"){
            Color(hex: 0x1e293b)
                .ignoresSafeArea(.all)
                .overlay {
                    WebViewsStacked(webViews: self.webViews)
                        .onDisappear {
                            exit(0)
                        }
                        .padding(1)
                        .toolbar { }
                        .toolbarBackground(Color(hex: 0x1e293b))
                }
        }
        #else
        WindowGroup("FullStacked"){
            if #available(iOS 16.0, *) {
                WebViewsStacked(webViews: self.webViews)
                    .onDisappear {
                        exit(0)
                    }
            } else {
                WebViewsStackedLegacy(webViews: self.webViews)
                    .onDisappear{
                        exit(0)
                    }
            }
        }
        #endif
        
        if #available(iOS 16.1, *) {
            WindowGroup(id: "window-webview", for: String.self) { $projectId in
                Color(hex: 0x1e293b)
                    .ignoresSafeArea(.all)
                    .overlay {
                        WebViewSingle(projectId: projectId)
                            .padding(1)
                            .toolbar { }
                            .toolbarBackground(Color(hex: 0x1e293b))
                    }
                
            }
            .commands {
                CommandGroup(replacing: CommandGroupPlacement.newItem) {
                    EmptyView()
                }
            }
        }
    }
}
