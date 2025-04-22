import { createServer } from ".";
import { deserializeArgs, serializeArgs } from "../../lib/bridge/serialization";
import { connect } from "./client";

const server = createServer(8888);
console.log("Listening on 8888");

const channel = server.createChannel("test");
channel.on((data) => {
    console.log(data);
    if(data === "ping") {
        console.log("pong");
        setTimeout(() => channel.send("ping"), 1000);
    }
});

// client
// const channelClient = connect("test", 8888);
// channelClient
//     .on(data => {
//         console.log(data);
//         if(data === "ping") {
//             console.log("Client pong");
//             setTimeout(() => channelClient.send("ping"), 1000);
//         }
//     })
//     .send("ping");