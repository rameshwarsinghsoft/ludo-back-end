const roomService = require('../services/room.service');
function initRoomHandlers(io, socket, rooms) {

    socket.on('create_room', (payload, callback) => {
        roomService.createRoom(io, socket, rooms, payload, callback);
    });

    socket.on('join_room', (payload, callback) => {
        roomService.joinRoom(io, socket, rooms, payload, callback);
    });

    socket.on('confirm_join_room', (payload, callback) => {
        roomService.confirmJoin(io, socket, rooms, payload, callback);
    });

    socket.on('quit_room', (payload, callback) => {
        roomService.quitRoom(io, socket, rooms, payload, callback);
    });
}

module.exports = { initRoomHandlers };
