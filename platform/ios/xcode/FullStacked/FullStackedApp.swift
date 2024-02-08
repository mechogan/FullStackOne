import SwiftUI

@main
struct FullStackedApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        
        WindowGroup(id: "running-app", for: Project.ID.self) { $projectID in
            WindowView(js: RunningProject.instance!.project!.js)
        }
    }
}


struct WindowView: View {
    let webview: WebView
    
    init(js: JavaScript) {
        self.webview = WebView(js: RunningProject.instance!.project!.js)
    }
    
    var body: some View {
        Button {
            self.webview.wkWebView?.reload()
        } label: {
            Image(systemName: "arrow.clockwise")
        }
        .keyboardShortcut("r", modifiers: .command)
        .opacity(0.0)
        .frame(width: 0.0, height: 0.0)
        self.webview
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
            .edgesIgnoringSafeArea(.all)
            .ignoresSafeArea()
    }
}
