const { WebSocketServer } = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

const rooms = {}; // code -> { host: ws, client: ws }

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === "create") {
                // Generate random 4-letter room code
                const code = Math.random().toString(36).substring(2, 6).toUpperCase();
                rooms[code] = { host: ws, client: null };
                currentRoom = code;
                ws.send(JSON.stringify({ type: "created", code: code }));
            } 
            else if (msg.type === "join") {
                const code = msg.code.toUpperCase();
                if (rooms[code] && !rooms[code].client) {
                    rooms[code].client = ws;
                    currentRoom = code;
                    ws.send(JSON.stringify({ type: "joined", code: code }));
                    // Alert host that client connected
                    rooms[code].host.send(JSON.stringify({ type: "peer_joined", id: 2 }));
                } else {
                    ws.send(JSON.stringify({ type: "error", message: "Room not found or full" }));
                }
            } 
            else if (msg.type === "signal") {
                // Forward WebRTC SDP offers/answers/ICE candidates between host and client
                if (!currentRoom || !rooms[currentRoom]) return;
                const target = (ws === rooms[currentRoom].host) ? rooms[currentRoom].client : rooms[currentRoom].host;
                if (target) {
                    target.send(JSON.stringify({ type: "signal", data: msg.data }));
                }
            }
        } catch (e) {
            console.error(e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            const other = (ws === rooms[currentRoom].host) ? rooms[currentRoom].client : rooms[currentRoom].host;
            if (other) other.send(JSON.stringify({ type: "peer_left" }));
            delete rooms[currentRoom];
        }
    });
});

console.log(`WebRTC Signaling running on port ${port}`);
