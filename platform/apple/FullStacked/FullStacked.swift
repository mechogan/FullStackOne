import SwiftUI

@main
struct FullStackedApp: App {
    static var singleton: FullStackedApp?
    @ObservedObject var webViews = WebViews()

    init() {
        FullStackedApp.singleton = self;
        
        setDirectories()
        setCallback()
    }
    
    var body: some Scene {
        #if os(macOS)
        Window("FullStacked", id: "Editor"){
            WebViewsStacked(webViews: self.webViews)
                .onDisappear {
                    exit(0)
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
                WebViewSingle(projectId: projectId)
            }
            .commands {
                CommandGroup(replacing: CommandGroupPlacement.newItem) {
                    EmptyView()
                }
            }
        }
    }
}



