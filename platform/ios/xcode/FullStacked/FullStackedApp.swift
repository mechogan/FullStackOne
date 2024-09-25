import SwiftUI

@main
struct FullStackedApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        
        if #available(iOS 16.1, *) {
            WindowGroup(id: "FullStacked", for: UUID.self) { instanceId in
                WindowView(instanceId: instanceId.wrappedValue!)
            }
        }
    }
}

struct WindowView: View {
    let originalInstanceId: UUID
    var instance: Instance
    
    @ObservedObject var jsLogs = JsLogs()
    @State private var jsConsole: Bool = false
    
    init(instanceId: UUID) {
        self.originalInstanceId = instanceId;
        let instanceIndex = RunningInstances.singleton!.instances.firstIndex { $0.id == instanceId }!
        self.instance = Instance(adapter: RunningInstances.singleton!.instances[instanceIndex].adapter)
        RunningInstances.singleton?.instancesInWindows.append(self.instance)
        
        self.instance.webview.logFn = { [self] log in
            self.jsLogs.logs += "\n\n" + log
        }
    }
    
    var body: some View {
        VStack {
            HStack {
                Button {
                    self.jsLogs.logs = "";
                    self.instance.webview.reload()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                    .keyboardShortcut("r", modifiers: .command)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                    
                Button {
                    self.jsConsole = !self.jsConsole
                } label: {
                    Image(systemName: "square.topthird.inset.filled")
                }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
            }
            
            ScrollView {
                Text(self.jsLogs.logs)
                    .lineLimit(.max)
                    .font(.system(size: 10, design: .monospaced))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                    .padding(EdgeInsets(top: 3, leading: 0, bottom: 0, trailing: 0))
                    .rotationEffect(.degrees(180.0))
            }
                .frame(maxWidth: .infinity, maxHeight: self.jsConsole ? 200 : 0)
                .rotationEffect(.degrees(180.0))
            
            
            InstanceRepresentable(instance: self.instance)
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .edgesIgnoringSafeArea(.all)
                .ignoresSafeArea()
                
        }
            .onAppear {
                RunningInstances.singleton?.removeInstance(id: self.originalInstanceId)
            }
            .onDisappear {
                self.instance.webview.logFn = nil
                RunningInstances.singleton?.removeInstance(id: self.instance.id)
            }
    }
}
