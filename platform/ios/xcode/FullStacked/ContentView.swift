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
    @Published var instances: [Instance] = []
    var instancesInWindows: [Instance] = []
    
    init() {
        RunningInstances.singleton = self;
    }
    
    func addInstance(instance: Instance) {
        self.instances.append(instance)
    }
    
    func getInstance(projectDirectory: String) -> Instance? {
        let index = self.instances.firstIndex(where: { $0.adapter.fs.baseDirectory == projectDirectory })
        if(index != nil){
            return self.instances[index!]
        }
            
        let indexInWindow = self.instancesInWindows.firstIndex(where: { $0.adapter.fs.baseDirectory == projectDirectory })
        if(indexInWindow != nil){
            return self.instancesInWindows[indexInWindow!]
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

class JsLogs: ObservableObject {
    @Published var logs: String = "";
}

struct RunningInstanceView: View {
    @Environment(\.supportsMultipleWindows) private var supportsMultipleWindows
    @Environment(\.openWindow) private var openWindow
    
    @ObservedObject var jsLogs = JsLogs()
    @State private var jsConsole: Bool = false
    
    let instance: Instance;
    
    init(_ instance: Instance){
        self.instance = instance
        self.instance.webview.logFn = { [self] log in
            self.jsLogs.logs += "\n\n" + log
        }
    }
    
    var body: some View {
        VStack {
            HStack {
                Button {
                    RunningInstances.singleton?.removeInstance(id: self.instance.id)
                } label: {
                    Image(systemName: "xmark")
                }
                .keyboardShortcut("w", modifiers: .command)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(EdgeInsets(top: 5, leading: 10, bottom: 2, trailing: 10))
                
                Button {
                    self.jsConsole = !self.jsConsole
                } label: {
                    Image(systemName: "square.topthird.inset.filled")
                }
                    .frame(maxWidth: .infinity, alignment: self.supportsMultipleWindows ? .center : .trailing)
                    .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                
                if self.supportsMultipleWindows {
                    Button {
                        openWindow(id: "FullStacked", value: self.instance.id)
                    } label : {
                        Image(systemName: "rectangle.split.2x1.fill")
                    }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(EdgeInsets(top: 5, leading: 10, bottom: 0, trailing: 10))
                }
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
        .background(Color.black)
    }
}

struct ContentView: View {
    @ObservedObject var runningInstances = RunningInstances()
    var instanceEditor = InstanceEditor()
    
    var body: some View {
        ZStack {
            Color(hex: 0x1e293b)
                .ignoresSafeArea()
            
            Image(uiImage: UIImage(named: "build/assets/dev-icon.png")!)
                .resizable()
                .frame(width: 100, height: 100, alignment: .center)
            
            InstanceRepresentable(instance: self.instanceEditor)
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
                    RunningInstanceView(instanceRepresentable)
                }
            }
            
        }
        .onOpenURL { url in
            self.instanceEditor.push(messageType: "launchURL", message: url.absoluteString)
        }
    }
}

#Preview {
    ContentView()
}
