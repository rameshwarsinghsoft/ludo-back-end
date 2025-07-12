
const jwt = require('jsonwebtoken');
const { initRoomHandlers } = require('./handlers/room.handler');
const { initGameHandlers } = require('./handlers/game.handler');
const initGameSocket = (io) => {
    // Handle low-level connection errors
    io.engine.on('connection_error', (err) => {
        console.error('Low-level Connection Error:', {
            message: err.message,
            code: err.code,
            headers: err.req?.headers || null,
            url: err.req?.url || null,
        });
    });

    io.use((socket, next) => {
        const token = socket.handshake.query.token;
        if (!token) {
            return next(new Error('Authentication error: Token is missing'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    const rooms = {};

    function updateSocketIdByEmail(socket) {
        const targetEmail = socket.user.email;
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const player = room.players.find(p => p.email === targetEmail);
            if (player) {
                console.log(`✅ Updated socketId for ${targetEmail} in room ${roomId}`);
                player.socketId = socket.id;
                socket.join(roomId);
                return true; // Exit early after update
            }
        }
        console.warn(`⚠️ Email ${targetEmail} not found in any room`);
        return false;
    }

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.email} | Socket ID: ${socket.id}`);
        // Update the socket ID for the user if they exist in any room
        const updated = updateSocketIdByEmail(socket);
        if (!updated) {
            console.log(`ℹ️ No existing player found with email ${socket.user.email}`);
        }

        // Register all room related socket events
        initRoomHandlers(io, socket, rooms);

        // Register game events
        initGameHandlers(io, socket, rooms);

        socket.on('disconnect', (reason) => {
            console.log(`User disconnected: ${socket.user.email} | Socket ID: ${socket.id} | Reason: ${reason}`);

            if (socket.conn && socket.conn.transport && socket.conn.transport.name) {
                console.log(`🚚 Transport used: ${socket.conn.transport.name}`);
            }

            // Client namespace disconnect
            // Triggered when a player leaves the game and disconnect socket

            // Transport closed
            // Happens when the screen is turned off (e.g., mobile screen off)
            // If the connection auto-reconnects when the screen turns back on,
            // then no action like room deletion is required


            // if (reason !== "transport close") {
            //     console.log("if block")
            //     for (const [roomCode, room] of Object.entries(rooms)) {
            //         const playerIndex = room.players.findIndex(player => player.socketId === socket.id);
            //         if (playerIndex !== -1) {
            //             room.players.splice(playerIndex, 1); // Remove player from the room

            //             if (room.players.length === 0) {
            //                 delete rooms[roomCode]; // Remove room if no players left
            //                 console.log(`Room ${roomCode} deleted due to inactivity.`);
            //             } else {
            //                 io.to(roomCode).emit('player_left', {
            //                     message: "A player left the game",
            //                     players: room.players
            //                 });
            //             }
            //             break;
            //         }
            //     }
            // } else {
            //     console.log("else block")
            // }

        });
    });
}

module.exports = { initGameSocket }