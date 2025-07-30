// npx esbuild --bundle --platform=node index.ts | node

import { createServer } from "./server";
import { connect } from "./client";

const server = createServer(8888, "0.0.0.0");
console.log("Listening on 8888");

const channel = server.createChannel("test");
channel.on((data) => {
    console.log("Server Data", data);
    if (data.at(0) === "ping") {
        console.log("Server pong");
        setTimeout(() => channel.send("ping"), 1000);
    }
});

const channelClient = connect("test", 8888);
channelClient
    .on(data => {
        console.log("Client Data", data);
        if(data.at(0) === "ping") {
            console.log("Client pong");
            setTimeout(() => channelClient.send("ping"), 1000);
        }
    })
    .send("ping");
