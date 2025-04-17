import net from "net";
import { bytesToNumber, DataType, deserializeArgs, serializeArgs } from "../../lib/bridge/serialization";

export type Data = string | number | boolean | Uint8Array;

type DataSocket = {
    socket: net.Socket,
    buffer: Uint8Array,
    channel: DataChannel
}

type DataChannel = {
    send: DataListener,
    dataSockets: Set<DataSocket>
}

type Channels = Map<string, DataChannel>

type DataServer = {
    server: net.Server,
    channels: Channels,
    connecting: Set<DataSocket>
}

export type DataListener = (data: Data) => void;

function send(this: { listeners: Set<DataListener> }, data: Data) {
    this.listeners.forEach(cb => cb(data));
}

function createChannel(this: { dataServer: DataServer }, name: string) {
    const listeners = new Set<DataListener>();
    const dataSockets = new Set<DataSocket>();
    this.dataServer.channels.set(name, {
        dataSockets,
        send: send.bind({ listeners }),
    });

    return {
        send(data: Data | Data[]) {
            const serialized = serializeArgs(Array.isArray(data) ? data : [data]);
            dataSockets.forEach(({ socket }) => socket.write(serialized));
        },
        on(callback: DataListener) {
            listeners.add(callback)
        },
        off(callback: DataListener) {
            listeners.delete(callback)
        }
    }
}

const td = new TextDecoder();

function tryUpgrade(server: DataServer, dataSocket: DataSocket) {
    if (dataSocket.buffer.at(0) !== DataType.STRING) {
        dataSocket.socket.end();
        return false;
    }

    if (dataSocket.buffer.byteLength < 5) return false;

    const dataLength = bytesToNumber(dataSocket.buffer.slice(1, 5));
    if (dataLength > dataSocket.buffer.byteLength - 5) return false;

    const channelName = td.decode(dataSocket.buffer.slice(5, 5 + dataLength));
    if (!server.channels.has(channelName)) {
        dataSocket.socket.end();
        console.log(`Socket trying to connect to unknown channel [${channelName}]`);
        return false;
    }

    console.log(`Socket upgrading to channel [${channelName}]`);

    dataSocket.buffer = dataSocket.buffer.slice(5 + dataLength);
    dataSocket.channel = server.channels.get(channelName);
    dataSocket.channel.dataSockets.add(dataSocket);
    server.connecting.delete(dataSocket);
    dataSocket.socket.on("close", () => server.channels.get(channelName)?.dataSockets?.delete(dataSocket));
    return true;
}

function trySend(dataSocket: DataSocket) {
    if (dataSocket.buffer.byteLength < 5) return false;
    const dataLength = bytesToNumber(dataSocket.buffer.slice(1, 5));
    if (dataLength > dataSocket.buffer.byteLength - 5) return false;
    const data = deserializeArgs(dataSocket.buffer.slice(0, 5 + dataLength));
    dataSocket.channel.send(data.at(0));
    dataSocket.buffer = dataSocket.buffer.slice(5 + dataLength);
    return true;
}

function onData(this: { server: DataServer, socket: DataSocket }, chunk: Buffer<ArrayBufferLike>) {
    const bufferSize = this.socket.buffer.byteLength + chunk.byteLength;
    const buffer = new Uint8Array(bufferSize);
    buffer.set(this.socket.buffer);
    buffer.set(chunk, this.socket.buffer.byteLength);
    this.socket.buffer = buffer;

    let keepProcessing: boolean;
    do {
        if (this.server.connecting.has(this.socket)) {
            keepProcessing = tryUpgrade(this.server, this.socket);
        } else {
            keepProcessing = trySend(this.socket);
        }
    } while (keepProcessing && this.socket.buffer.byteLength > 0)
}

function connectSocket(this: DataServer, socket: net.Socket) {
    const dataSocket: DataSocket = {
        socket,
        buffer: new Uint8Array(),
        channel: null,
    }

    this.connecting.add(dataSocket);
    socket.on("data", onData.bind({ server: this, socket: dataSocket }));
    socket.on("close", () => this.connecting.delete(dataSocket));
}

export function createServer(port: number) {
    const dataServer: DataServer = {
        server: net.createServer(),
        channels: new Map(),
        connecting: new Set()
    }
    dataServer.server.on("connection", connectSocket.bind(dataServer));
    dataServer.server.listen(port);
    return {
        dataServer,
        createChannel,
        end() {
            this.dataServer.server.close();
        }
    }
}