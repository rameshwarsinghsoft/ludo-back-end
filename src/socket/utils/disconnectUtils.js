const roomService = require('../services/room.service');
const gameService = require('../services/game.service');

function handlePlayerRoomQuit(io, socket, rooms, payload, callback = null) {
    roomService.quitRoom(io, socket, rooms, { roomCode: payload, callback });
}

function handlePlayerGameQuit(io, socket, rooms, payload, callback = null) {
    gameService.quitGame(io, socket, rooms, { roomCode: payload, callback });
}

function handlePlayerDisconnect(io, socket, rooms, joinedRooms) {
    for (const roomCode of joinedRooms) {
        const room = rooms[roomCode];
        if (!room) continue;

        let { players, gameStatus } = room;
        if (players.length > 1 && !gameStatus.isStarted) {
            handlePlayerRoomQuit(io, socket, rooms, roomCode)
        }

        // if (players.length > 1 && gameStatus.isStarted) {
        if (players.length > 1 && gameStatus.isStarted && !gameStatus.isFinished) {
            handlePlayerGameQuit(io, socket, rooms, roomCode)
        }
    }
}

module.exports = {
    handlePlayerDisconnect
};