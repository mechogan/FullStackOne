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
    @State private var jsConsole: Bool = false
    @ObservedObject private var runningProject = RunningProject.instance!
    let webview: WebView
    
    init(js: JavaScript) {
        self.webview = WebView(js: RunningProject.instance!.project!.js)
    }
    
    var body: some View {
        VStack {
            HStack {
                
                Button {
                    self.webview.wkWebView.reload()
                    RunningProject.instance!.jsLogs = ""
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .keyboardShortcut("r", modifiers: .command)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                
                Button {
                    jsConsole = !jsConsole
                } label: {
                    Image(systemName: "square.topthird.inset.filled")
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                
            }
            
            ScrollView {
                Text(self.runningProject.jsLogs)
                    .lineLimit(.max)
                    .font(.system(size: 10, design: .monospaced))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                    .padding(EdgeInsets(top: 3, leading: 0, bottom: 0, trailing: 0))
                    .rotationEffect(.degrees(180.0))
            }
            .frame(maxWidth: .infinity, maxHeight: jsConsole ? 200 : 0)
            .rotationEffect(.degrees(180.0))
            
            
            self.webview
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .edgesIgnoringSafeArea(.all)
                .ignoresSafeArea()
        }
    }
}
