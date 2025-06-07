import { createServer } from ".";

const server = createServer(8888, "0.0.0.0");
console.log("Listening on 8888");

const channel = server.createChannel("test");
channel.on((data) => {
    if (data.at(0) === "ping") {
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
