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

struct ContentView: View {
    let instanceRepresentableEditor = InstanceRepresentable(instance: InstanceEditor());

    
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
        }
    }
}

#Preview {
    ContentView()
}
