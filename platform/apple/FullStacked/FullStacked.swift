import SwiftUI

let EditorColor = 0x1E293B

// source: https://github.com/scottcorgan/contrast/blob/master/index.js
func getBestSuitedColorScheme(c: Int) -> ColorScheme {
    let r = ((c >> 16) & 0xff)
    let g = ((c >>  8) & 0xff)
    let b = ((c      ) & 0xff)
    let o = ((r * 299) + (g * 587) + (b * 114)) / 1000
    return o >= 180 ? .light : .dark
}

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
                        .toolbar {
                            Spacer()
                        }
                        .navigationTitle("FullStacked")
                        .preferredColorScheme(.dark)
                }
        }
        #else
        WindowGroup("FullStacked"){
            if #available(iOS 16.0, *) {
                if isIPadOS {
                    NavigationStack {
                        WebViewsStacked(webViews: self.webViews)
                            .onDisappear {
                                exit(0)
                            }
                            .preferredColorScheme(.dark)
                            .navigationBarTitleDisplayMode(.inline)
                            .navigationTitle("FullStacked")
                    }
                } else {
                    WebViewsStacked(webViews: self.webViews)
                        .onDisappear {
                            exit(0)
                        }
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
            WindowGroup("Project", id: "window-webview", for: String.self) { $projectId in
                Color(hex: webViews.getColor(projectId: projectId))
                    .ignoresSafeArea(.all)
                    .overlay {
                        #if os(macOS)
                            WebViewSingle(projectId: projectId)
                                .toolbar {
                                    Spacer()
                                }
                                .preferredColorScheme(getBestSuitedColorScheme(c: webViews.getColor(projectId: projectId)))
                                .navigationTitle(projectId ?? "Project")
                        #else
                            NavigationStack {
                                WebViewSingle(projectId: projectId)
                                    .navigationBarTitleDisplayMode(.inline)
                                    .preferredColorScheme(getBestSuitedColorScheme(c: webViews.getColor(projectId: projectId)))
                                    .navigationTitle(projectId ?? "Project")
                            }
                        #endif
                    }
                    .navigationTitle(projectId ?? "Project")
            }
            .commands {
                CommandGroup(replacing: CommandGroupPlacement.newItem) {
                    EmptyView()
                }
            }
        }
    }
}
