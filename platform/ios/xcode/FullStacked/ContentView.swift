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

class RunningInstances: ObservableObject {
    static var singleton: RunningInstances?
    @Published var instances: [InstanceRepresentable] = []
    var instancesInWindows: [InstanceRepresentable] = []
    
    init() {
        RunningInstances.singleton = self;
    }
    
    func addInstance(instance: Instance) {
        self.instances.append(InstanceRepresentable(instance: instance))
    }
    
    func getInstance(projectDirectory: String) -> Instance? {
        let index = self.instances.firstIndex(where: { $0.instance.adapter.fs.baseDirectory == projectDirectory })
        if(index != nil){
            return self.instances[index!].instance
        }
            
        let indexInWindow = self.instancesInWindows.firstIndex(where: { $0.instance.adapter.fs.baseDirectory == projectDirectory })
        if(indexInWindow != nil){
            return self.instancesInWindows[indexInWindow!].instance
        }
        
        return nil
    }
    
    func removeInstance(id: UUID) {
        let index = self.instances.firstIndex(where: { $0.id == id })
        if(index != nil){
            self.instances.remove(at: index!)
        }
            
        let indexInWindow = self.instancesInWindows.firstIndex(where: { $0.id == id })
        if(indexInWindow != nil){
            self.instancesInWindows.remove(at: indexInWindow!)
        }
    }
}

struct ContentView: View {
    @Environment(\.supportsMultipleWindows) private var supportsMultipleWindows
    @Environment(\.openWindow) private var openWindow

    @ObservedObject var runningInstances = RunningInstances()
    var instanceRepresentableEditor: InstanceRepresentable
    
    init(){
        let instanceEditor = InstanceEditor()
        self.instanceRepresentableEditor = InstanceRepresentable(instance: instanceEditor)
        (instanceEditor.adapter as! AdapterEditor).runInstance = { [self] instance in
            self.runningInstances.addInstance(instance: instance)
        }
    }
    
    var body: some View {
        ZStack {
            Color(hex: 0x1e293b)
                .ignoresSafeArea()
            
            Image(uiImage: UIImage(named: "build/assets/dev-icon.png")!)
                .resizable()
                .frame(width: 100, height: 100, alignment: .center)
            
            instanceRepresentableEditor
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .edgesIgnoringSafeArea(.all)
                .ignoresSafeArea()
                .overlay(alignment: .top) {
                    Color(hex: 0x1e293b)
                        .ignoresSafeArea(edges: .top)
                        .frame(height: 0)
                }
            if self.runningInstances.instances.count > 0 {
                ForEach(self.runningInstances.instances, id: \.id) { instanceRepresentable in
                    VStack {
                        HStack {
                            Button {
                                self.runningInstances.removeInstance(id: instanceRepresentable.id)
                            } label: {
                                Image(systemName: "xmark")
                            }
                            .keyboardShortcut("w", modifiers: .command)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(EdgeInsets(top: 5, leading: 10, bottom: 2, trailing: 10))
                            
                            if self.supportsMultipleWindows {
                                Button {
                                    openWindow(id: "FullStacked", value: instanceRepresentable.id)
                                } label : {
                                    Image(systemName: "rectangle.split.2x1.fill")
                                }
                                .frame(maxWidth: .infinity, alignment: .trailing)
                                .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                            }
                        }
                        instanceRepresentable
                            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                            .edgesIgnoringSafeArea(.all)
                            .ignoresSafeArea()
                    }
                    .background(Color.black)
                }
            }
            
        }
        .onOpenURL { url in
            self.instanceRepresentableEditor.instance.push(messageType: "launchURL", message: url.absoluteString)
        }
    }
}

#Preview {
    ContentView()
}
