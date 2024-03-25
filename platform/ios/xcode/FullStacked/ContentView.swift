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
    @Published var instances: [InstanceRepresentable] = []
    func addInstance(instance: Instance) {
        self.instances.append(InstanceRepresentable(instance: instance))
    }
    func removeInstance(id: UUID) {
        let index = self.instances.firstIndex(where: { $0.id == id })!
        self.instances.remove(at: index)
    }
}

struct ContentView: View {
    @ObservedObject private var runningInstances = RunningInstances()
    let instanceRepresentableEditor: InstanceRepresentable
    
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
    }
}

#Preview {
    ContentView()
}
