import { bridge } from "../bridge";
import { serializeArgs } from "../bridge/serialization";
import core_message from "../core_message";
import { toByteArray } from "../base64";

export type Data = string | number | boolean | Uint8Array;

type DataChannelCallback = (data: Data[]) => void;

type DataChannel = {
    send(...args: Data[]): void,
    on(callback: DataChannelCallback): void,
    off(callback: DataChannelCallback): void,
}

type DataChannelRawCallback = (data: Uint8Array) => void;

type DataChannelRaw = {
    send(buffer: Uint8Array): void
    on(callback: DataChannelRawCallback): void,
    off(callback: DataChannelRawCallback): void,
}

type Channel = {
    raw: false,
    listeners: Set<DataChannelCallback>
}

type ChannelRaw = {
    raw: true,
    listeners: Set<DataChannelRawCallback>
}

const channels = new Map<string, Channel | ChannelRaw>();

// 20
export function connect(name: string, port: number, host: string, stream: false): Promise<DataChannel>
export function connect(name: string, port: number, host: string, stream: true): Promise<DataChannelRaw>
export function connect(name: string, port: number, host = "localhost", stream = false) {
    const payload = new Uint8Array([
        20,
        ...serializeArgs([
            name,
            port,
            host
        ])
    ]);

    const transformer = ([channelId]) => {
        if (stream) {
            const listeners = new Set<DataChannelRawCallback>();

            const channel: ChannelRaw = {
                raw: true,
                listeners
            }

            channels.set(channelId, channel);

            core_message.addListener("channel-" + channelId, (dataStr) => {
                const data = toByteArray(dataStr);
                listeners.forEach(cb => cb(data));
            });

            return {
                send: (data) => send(channelId, data),
                on: (cb) => listeners.add(cb),
                off: (cb) => listeners.add(cb)
            } as DataChannelRaw
        } else {
            const listeners = new Set<DataChannelCallback>();

            const channel: Channel = {
                raw: false,
                listeners
            }

            core_message.addListener("channel-" + channelId, (dataStr) => {
                const data = toByteArray(dataStr);
                listeners.forEach(cb => cb(data));
            });

            channels.set(channelId, channel);

            return {
                send: (...data) => send(channelId, data),
                on: (cb) => listeners.add(cb),
                off: (cb) => listeners.add(cb)
            } as DataChannel
        }
    };
    
    return bridge(payload, transformer);
}

// 21
function send(channelId: string, data: Data[] | Uint8Array) {
    const userData = data instanceof Uint8Array
        ? data
        : new Uint8Array([
            data.length,
            ...serializeArgs(data)
        ]);

    const payload = new Uint8Array([
        21,
        ...serializeArgs([channelId, userData])
    ]);

    return bridge(payload);
}