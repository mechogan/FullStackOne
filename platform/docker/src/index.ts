import http from "http";
import { Instance } from "../../node/src/instance";

const instanceEditor = null;

// subdomain => Instance
const instances = new Map<string, Instance>();


const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const host = (req.headers["x-forwarded-for"] || req.headers.host).toString();

    const maybeSubdomainRouting = host.split(".").shift();

    const instance = instances.get(maybeSubdomainRouting);
    
    
    const response = instance ? instance.handler(req.)
}


const server = http.createServer(requestHandler);

server.listen(process.env.PORT || 9000);