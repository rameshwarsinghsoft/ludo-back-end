function isRoomActive(room, io) {
    return room.players.some(p => io.sockets.sockets.has(p.socketId));
}

// If all socket IDs become inactive, delete the room.
function deleteInactiveRooms(io, rooms) {
    for (const roomId in rooms) {
        const room = rooms[roomId];

        const activePlayers = room.players.filter(p =>
            io.sockets.sockets.has(p.socketId)
        );

        if (activePlayers.length === 0) {
            console.log(`🧹 Deleting inactive room: ${roomId}`);
            delete rooms[roomId];
        }
    }
}

function startRoomCleanupTimer(io, rooms, interval = 60 * 1000) {
    setInterval(() => {
        deleteInactiveRooms(io, rooms);
    }, interval);
}

module.exports = {
    isRoomActive,
    deleteInactiveRooms,
    startRoomCleanupTimer
};


// room delete yadi finished ho gya hai to :- lekin popup pe result kese dikhayenge yadi data remove ho gya to

// in room create:- 
// 1. yadi app ne room create kiya hai or app same id se dusare or device me room create nhi kar sakte yadi apka game finished na hua ho,