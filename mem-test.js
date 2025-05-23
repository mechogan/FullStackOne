import http from "http";
import child_process from "child_process";

http.createServer((_, res) => res.end(child_process.execSync(`ps -q ${process.argv[2]} -o rss=`))).listen(6061, "0.0.0.0")