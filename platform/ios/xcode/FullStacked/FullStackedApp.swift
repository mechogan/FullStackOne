import SwiftUI

@main
struct FullStackedApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        
        WindowGroup(id: "FullStacked", for: UUID.self) { instanceRepresentableId in
            WindowView(instanceId: instanceRepresentableId.wrappedValue!)
        }
    }
}

struct WindowView: View {
    var instanceRepresentable: InstanceRepresentable
    
    init(instanceId: UUID) {
        let instanceRepresentableIndex = RunningInstances.singleton!.instances.firstIndex { instanceRepresentable in
            return instanceRepresentable.id == instanceId
        }!
        self.instanceRepresentable = InstanceRepresentable(instance: Instance(adapter: RunningInstances.singleton!.instances[instanceRepresentableIndex].instance.adapter))
        RunningInstances.singleton?.instancesInWindows.append(self.instanceRepresentable)
        RunningInstances.singleton?.removeInstance(id: instanceId)
    }
    
    var body: some View {
        VStack {
            HStack {
                Button {
                    self.instanceRepresentable.instance.webview.reload()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                    .keyboardShortcut("r", modifiers: .command)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                    
                Button {

                } label: {
                    Image(systemName: "square.topthird.inset.filled")
                }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                
            }
            
            
            self.instanceRepresentable
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .edgesIgnoringSafeArea(.all)
                .ignoresSafeArea()
                .onDisappear() {
                    RunningInstances.singleton?.removeInstance(id: self.instanceRepresentable.id)
                }
        }
    }
}
