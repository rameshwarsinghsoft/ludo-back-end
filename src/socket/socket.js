
const jwt = require('jsonwebtoken');
const { initRoomHandlers } = require('./handlers/room.handler');
const { initGameHandlers } = require('./handlers/game.handler');
const { initDisconnectHandler } = require('./handlers/disconnect.handler');
const { startRoomCleanupTimer } = require('./utils/roomCleaner');
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

    // ✅ Ensures cleanup runs only once
    let cleanupStarted = false;

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

        // ✅ Cleanup timer should start only once
        if (!cleanupStarted) {
            startRoomCleanupTimer(io, rooms);
            cleanupStarted = true;
        }

        // Disconnect
        initDisconnectHandler(io, socket, rooms);
    });
}

module.exports = { initGameSocket }