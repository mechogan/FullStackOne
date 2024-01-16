import Foundation

let portArg = CommandLine.arguments.count > 1
    ? UInt16(CommandLine.arguments[1])
    : 8080
let port = portArg!
print("Starting as server on port: \(port)")
if #available(macOS 11.0, *) {
    let server = Server(port: port)
    try! server.start()
}
RunLoop.current.run()
