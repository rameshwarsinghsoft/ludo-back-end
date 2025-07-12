function generateRoomCode(rooms) {
    let code;
    do {
        code = Math.floor(10000000 + Math.random() * 90000000).toString();
    } while (rooms[code]); // Ensure unique room code
    return code;
}

function createPlayer(socket, color = "blue", isCreator = false) {
    return {
        socketId: socket.id,
        _id: socket.user._id,
        email: socket.user.email,
        name: socket.user.name,
        isCreator,
        color,
        gameStatus: {
            state: "active",
            reason: null,
            auto_moves: 5,
            rank: 0,
            name: socket.user.name,
            outcome: null
        },
        tokens: Array(4).fill({ relPos: 0, globalPos: -1 }),
        dice: { dice_rolls: [1, 1, 1] }
    };
}

function getColorForPlayer(totalPlayers, maxPlayers) {


    // const { maxPlayers, players } = rooms[roomCode];
    // const totalPlayers = players.length;

    const playerColor =
        maxPlayers === 2 ? "green" :
            maxPlayers === 4
                ? totalPlayers === 1 ? "red" :
                    totalPlayers === 2 ? "green" : "yellow"
                : null; // default case if needed

    return playerColor;
    // if (maxPlayers === 2) return "green";
    // const colors = ["red", "green", "yellow", "blue"];
    // return colors[count] || "blue";
}

function createRoom(io, socket, rooms, { maxPlayers }, callback) {
    if (![2, 4].includes(maxPlayers)) {
        return callback?.({ success: false, message: 'Invalid player limit. Choose 2 or 4 players.' });
    }

    const roomCode = generateRoomCode(rooms);
    const player = createPlayer(socket, "blue", true);

    rooms[roomCode] = {
        players: [player],
        maxPlayers,
        gameState: {},
        turnIndex: 0, // Tracks the current player's turn
        lastDiceRoll: null, // Stores the latest dice roll value
        lastFourDiceRolls: [{}, {}, {}, {}]
    };

    // Creator join the room
    socket.join(roomCode);

    callback?.({
        success: true,
        message: "Room created.",
        data: { roomCode, maxPlayers }
    });
}

function joinRoom(io, socket, rooms, { roomCode, desiredPlayers }, callback) {
    const room = rooms[roomCode];
    if (!room) return callback?.({ success: false, is_room_code: false, message: "Invalid room code" });

    if (![2, 4].includes(desiredPlayers)) {
        return callback?.({ success: false, message: "Invalid number of desired players. Please select either 2 or 4 players." });
    }

    if (room.maxPlayers !== desiredPlayers) {
        return callback?.({
            success: false,
            is_room_code: true,
            message: `This room is for ${room.maxPlayers} players. Do you want to join?.`
        });
    }

    if (room.players.find(p => p.email === socket.user.email)) {
        return callback?.({ success: false, message: "You're already in this room" });
    }

    if (room.players.length >= room.maxPlayers) {
        return callback?.({ success: false, message: "Room is full" });
    }

    const color = getColorForPlayer(room.players.length, room.maxPlayers);
    const player = createPlayer(socket, color);
    room.players.push(player);
    socket.join(roomCode);

    const data = {
        roomCode,
        maxPlayers: room.maxPlayers,
        players: room.players
    };

    io.to(roomCode).emit('player_joined', { success: true, message: "Player joined.", data });
    callback?.({ success: true, message: "You joined the room." });
}

function confirmJoin(io, socket, rooms, { roomCode }, callback) {
    const room = rooms[roomCode];
    if (!room) return callback?.({ success: false, message: "Invalid room code" });

    if (room.players.find(p => p.email === socket.user.email)) {
        return callback?.({ success: false, message: "You are already in this room" });
    }

    if (room.players.length >= room.maxPlayers) {
        return callback?.({ success: false, message: "Room is full" });
    }

    const color = getColorForPlayer(room.players.length, room.maxPlayers);
    const player = createPlayer(socket, color);
    room.players.push(player);
    socket.join(roomCode);

    const data = {
        roomCode,
        maxPlayers: room.maxPlayers,
        players: room.players
    };

    io.to(roomCode).emit('player_joined', { success: true, message: "Player joined.", data });
    callback?.({ success: true, message: "You have successfully joined the room." });
}

function quitRoom(io, socket, rooms, { roomCode }, callback) {
    const room = rooms[roomCode];
    if (!room) return callback?.({ success: false, message: "Invalid room code" });

    const player = room.players.find(p => p.email === socket.user.email);
    if (!player) return callback?.({ success: false, message: "You are not in this room" });

    if (player.isCreator) {
        io.to(roomCode).emit('room_deleted', {
            success: true,
            message: "Room deleted by creator.",
            is_deleted_by: player.email
        });

        room.players.forEach(p => io.sockets.sockets.get(p.socketId)?.leave(roomCode));
        delete rooms[roomCode];
        return callback?.({ success: true, message: "Room deleted." });
    }

    room.players = room.players.filter(p => p.email !== socket.user.email);

    io.to(roomCode).emit('player_left_room', {
        success: true,
        message: `${player.name} left the room.`,
        email: player.email,
        _id: player._id
    });
    socket.leave(roomCode);
    callback?.({ success: true, message: "You left the room." });
}

module.exports = {
    createRoom,
    joinRoom,
    confirmJoin,
    quitRoom
};
