const logs = document.createElement("pre");
// document.body.append(logs);

const video = document.createElement("video");
document.body.append(video);
video.muted = true;
video.autoplay = true;
video.playsInline = true;

let firstTimestamp: number, lastTimestamp: number;

const init = () => {
    document.querySelector("span")?.remove();

    const mediaSource = new MediaSource();
    const url = URL.createObjectURL(mediaSource);
    video.src = url;

    mediaSource.addEventListener('sourceopen', () => {
        const videoSourceBuffer = mediaSource.addSourceBuffer("video/webm;codecs=vp8");
        videoSourceBuffer.mode = "sequence";
        let videoBuffer: {
            id: number,
            timestamp: number,
            data: Uint8Array
        }[] = [];
        let appendingBuffer = false;
        const appendBuffer = () => {
            if (appendingBuffer || videoBuffer.length === 0) return;
            appendingBuffer = true;

            const bufferLength = videoBuffer.reduce((tot, part) => tot + part.data.length, 0);
            const buffer = new Uint8Array(bufferLength);
            let cursor = 0;
            while (videoBuffer.length) {
                const part = videoBuffer.shift();
                if (!firstTimestamp) firstTimestamp = part.timestamp;
                buffer.set(part.data, cursor);
                cursor += part.data.byteLength;
                if (videoBuffer.length === 0) lastTimestamp = part.timestamp;
            }

            videoSourceBuffer.appendBuffer(buffer);
        }

        videoSourceBuffer.addEventListener('updateend', function (ev) {
            video.play();
            appendingBuffer = false;
            if (videoBuffer.length) {
                appendBuffer();
            }
        });

        const receiveVideoData = (id: number, timestamp: number, data: Uint8Array) => {
            videoBuffer.push({ id, timestamp, data });
            appendBuffer();
        }

        restartWebSocket(receiveVideoData)
    })
}

let ws: WebSocket, messageID = 0;
const restartWebSocket = (writeVideoBuffer: (id: number, timestamp: number, data: Uint8Array) => void) => {
    const url = new URL(window.location.href);
    url.protocol = "ws:";
    ws = new WebSocket(url.toString());
    ws.binaryType = "arraybuffer";

    ws.onmessage = async messageEvent => {
        if (typeof messageEvent.data === "string") {
            const json = JSON.parse(messageEvent.data);
            if (json.log) {
                console.log(json.log);
            } else if (json.viewport) {
                resize(json.viewport);
            } else if (json.tabs) {
                renderTabsList(json.tabs);
            } else if (json.webrtc) {
                handleWebRTC(JSON.parse(json.webrtc));
            } else {
                console.log(json)
            }
        } else {
            const data = new Uint8Array(messageEvent.data);
            const timestamp = data[0] << 24 | data[1] << 16 | data[2] << 8 | data[3];
            writeVideoBuffer(messageID++, timestamp, data.slice(4));
        }
    }
}

const restartButton = document.createElement("button");
restartButton.innerText = "Restart";
restartButton.style.cssText = `
position: fixed;
top: 10px;
right: 10px;`;
restartButton.addEventListener("click", () => {
    ws?.send(JSON.stringify({ type: "restart" }));
    window.location.reload();
});
document.body.append(restartButton);

let viewport: { height: number, width: number };
const resize = (size: typeof viewport) => {
    viewport = size;
    video.style.aspectRatio = (viewport.width / viewport.height).toString();
}

let isInit = false;
window.addEventListener("click", e => {
    if (!isInit) {
        init();
        isInit = true;
    }

    if (!viewport) return;

    const videoBB = video.getBoundingClientRect();

    const x = viewport.width * e.clientX / videoBB.width;
    const y = viewport.height * e.clientY / videoBB.height;

    ws?.send(JSON.stringify({ type: "click", x, y }));
    video.currentTime = lastTimestamp - firstTimestamp;
});

window.addEventListener("keyup", e => {
    if (!isInit) {
        init();
        isInit = true;
    }

    if (!viewport) return;

    const key = e.key;

    ws?.send(JSON.stringify({ type: "key", key }));
    video.currentTime = lastTimestamp - firstTimestamp;
});

const tabsList = document.createElement("ul");
document.body.append(tabsList);
const renderTabsList = (tabs: string[]) => {
    Array.from(tabsList.children).forEach(child => child.remove());
    tabs.forEach(url => {
        if (url === "about:blank" || url.startsWith("chrome-extension") || url === "http://localhost:9000/") {
            return;
        }
        const li = document.createElement("li");
        li.addEventListener("click", (e) => {
            e.stopPropagation();
            ws?.send(JSON.stringify({ type: "close", url }));
        })
        li.innerText = url;
        tabsList.append(li);
    })
}

function handleWebRTC(webrtcMessage: any) {
    switch (webrtcMessage.type) {
        case "offer":
            handleOffer(webrtcMessage)
            break;
        case "candidate":
            handleCandidate(webrtcMessage);
            break;
    }
}

let pc: RTCPeerConnection;
function createPeerConnection() {
    pc = new RTCPeerConnection();
    pc.onicecandidate = e => {
        const message: any = {
            type: 'candidate',
            candidate: null,
        };
        if (e.candidate) {
            message.candidate = e.candidate.candidate;
            message.sdpMid = e.candidate.sdpMid;
            message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        ws?.send(JSON.stringify({ type: "webrtc", message }));
    };
    pc.ontrack = e => video.srcObject = e.streams[0];
}

async function handleOffer(offer) {
    if (pc) {
        console.error('existing peerconnection');
        return;
    }
    await createPeerConnection();
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    const message = { type: 'answer', sdp: answer.sdp };
    ws?.send(JSON.stringify({ type: "webrtc", message }));
    await pc.setLocalDescription(answer);
}

async function handleCandidate(candidate) {
    if (!pc) {
        console.error('no peerconnection');
        return;
    }
    if (!candidate.candidate) {
        await pc.addIceCandidate(null);
    } else {
        await pc.addIceCandidate(candidate);
    }
}