import ffi from "ffi-rs"
import http from "http";
import open from "open";

const library = "fullstacked";
ffi.open({
    library: library,
    path: "./bin/macos-x86_64"
});


const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const path = req.url;
    console.log(path);
}

const port = 9000;

http
    .createServer(requestHandler)
    .listen(port);

open(`http://localhost:${port}`);

['SIGINT', 'SIGTERM', 'SIGQUIT']
  .forEach(signal => process.on(signal, () => {
    /** do your logic */
    process.exit();
  }));