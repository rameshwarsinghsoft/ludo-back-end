const { handlePlayerDisconnect } = require('../utils/disconnectUtils')
function initDisconnectHandler(io, socket, rooms) {

    let joinedRooms = [];

    // Step 1: Handle "disconnecting" to get rooms before disconnection
    socket.on('disconnecting', () => {
        joinedRooms = [...socket.rooms].filter(room => room !== socket.id);
    });

    socket.on('disconnect', (reason) => {
        // जब कोई socket disconnect होता है (chahe manually ya network issue se), वो socket.io के सभी rooms से अपने आप leave हो जाता है।

        // Client namespace disconnect
        // Triggered when a player leaves the game and disconnect socket

        // Transport closed
        // Happens when the screen is turned off (e.g., mobile screen off)
        // If the connection auto-reconnects when the screen turns back on,
        // then no action like room deletion is required

        const email = socket.user?.email;
        const socketId = socket.id;

        console.log(`❌ User disconnected: ${email} | Socket ID: ${socketId} | Reason: ${reason}`);

        // if (reason === "client namespace disconnect" || reason === "transport close") {
        if (reason === "client namespace disconnect") {
            if (joinedRooms.length > 0) {
                handlePlayerDisconnect(io, socket, rooms, joinedRooms);
            }
        }

        joinedRooms = [];
    });
}

module.exports = { initDisconnectHandler };