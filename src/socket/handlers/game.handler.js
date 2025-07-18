const gameService = require('../services/game.service');

function initGameHandlers(io, socket, rooms) {

    socket.on('game_start', (payload, callback) => {
        gameService.startGame(io, socket, rooms, payload, callback);
    });

    socket.on('roll_dice', (payload, callback) => {
        gameService.rollDice(io, socket, rooms, payload, callback);
    });

    socket.on('move_token', (payload, callback) => {
        gameService.moveToken(io, socket, rooms, payload, callback);
    });

    socket.on('quit_game', (payload, callback) => {
        gameService.quitGame(io, socket, rooms, payload, callback);
    });
}

module.exports = { initGameHandlers };