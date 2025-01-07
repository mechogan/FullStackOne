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
        WindowGroup("FullStacked"){
            if #available(iOS 16.0, *) {
                WebViewsStacked(webViews: self.webViews)
                    .onDisappear() {
                        exit(0)
                    }
            } else {
                WebViewsStackedLegacy(webViews: self.webViews)
                    .onDisappear() {
                        exit(0)
                    }
            }
        }
        
        if #available(iOS 16.1, *) {
            WindowGroup(id: "window-webview", for: String.self) { $projectId in
                if(projectId != nil && self.webViews.getView(projectId: projectId!) != nil) {
                    WebViewSingle(webView: self.webViews.getView(projectId: projectId!)!)
                        .onDisappear {
                            self.webViews.removeView(projectId: projectId!)
                        }
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



