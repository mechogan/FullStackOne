import SwiftUI

let EditorColor = 0x1E293B

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
            Color(hex: EditorColor)
                .ignoresSafeArea(.all)
                .overlay {
                    WebViewsStacked(webViews: self.webViews)
                        .onDisappear {
                            exit(0)
                        }
                        .padding(EdgeInsets(top: 1, leading: 0, bottom: 0, trailing: 0))
                        .toolbar { }
                        .preferredColorScheme(.dark)
                        .toolbarBackground(Color(hex: EditorColor))
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
                Color(hex: webViews.getColor(projectId: projectId))
                    .ignoresSafeArea(.all)
                    .overlay {
                        WebViewSingle(projectId: projectId)
                            .padding(EdgeInsets(top: 1, leading: 0, bottom: 0, trailing: 0))
                            .toolbar { }
                            .preferredColorScheme(.light)
                            .navigationTitle(projectId ?? "Project")
                            .toolbarBackground(Color(hex: webViews.getColor(projectId: projectId)))
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
