require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const port = process.env.PORT || 8000;

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    // connectionStateRecovery: {
    //     maxRetries: 5,  // How many times the server should retry a failed connection
    //     recoveryTimeout: 5000,  // How long to wait between retries (in milliseconds)
    // }
});

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
        // console.log("user : ", decoded)
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.email} | Socket ID: ${socket.id}`);

    // Creating a room with a specified player limit (2, 4, or 6)

    socket.on('create_room', ({ maxPlayers }, callback) => {
        if (![2, 4, 6].includes(maxPlayers)) {
            const errorResponse = {
                success: false,
                message: 'Invalid player limit. Choose 2, 4, or 6 players.',
            };
            return callback?.(errorResponse);
        }
        let roomCode;
        do {
            roomCode = Math.floor(10000000 + Math.random() * 90000000).toString();
        } while (rooms[roomCode]); // Ensure unique room code


        // Create the room
        rooms[roomCode] = {
            players: [{
                socketId: socket.id,
                _id: socket.user._id,
                email: socket.user.email,
                name: socket.user.name,
                isCreator: true,
                tokens: [0, 0, 0, 0]  // Each player starts with 4 tokens at position 0
            }],
            maxPlayers,
            gameState: {},
            turnIndex: 0,     // Tracks the current player's turn
            lastDiceRoll: null // Stores the latest dice roll value
        };

        // Join the room
        socket.join(roomCode);
        console.log(`Room ${roomCode} created by ${socket.user.email} | Max Players: ${maxPlayers}`);

        const response = {
            success: true,
            message: "Room created successfully.",
            data: {
                roomCode,
                maxPlayers
            }
        };

        callback?.(response);
    });

    socket.on('join_room', ({ roomCode, desiredPlayers }, callback) => {
        console.log(`Attempting to join room: ${roomCode}`);

        console.log("rooms : ", rooms)

        if (!rooms[roomCode]) {
            return callback?.({ success: false, is_room_code: false, message: 'Invalid room code' });
        }

        // if (desiredPlayers) {
        //     return callback?.({ success: false, message: `desired Players is required.` });
        // }

        // Validate desiredPlayers: It must be a positive integer
        if (!desiredPlayers || typeof desiredPlayers !== 'number' || desiredPlayers <= 0 || !Number.isInteger(desiredPlayers)) {
            return callback?.({
                success: false,
                message: `Invalid desiredPlayers value. It must be a positive integer.`
            });
        }

        if (desiredPlayers && rooms[roomCode].maxPlayers !== desiredPlayers) {
            // return callback?.({ success: false, is_room_code: true, message: `Invalid selection! The game can only be played with ${rooms[roomCode].maxPlayers} players.` });
            return callback?.({ success: false, is_room_code: true, message: `This room is for ${rooms[roomCode].maxPlayers} players. Do you want to join?.` });

        }

        if (rooms[roomCode].players.some(player => player.email === socket.user.email)) {
            return callback?.({ success: false, message: 'You are already in this room' });
        }

        if (rooms[roomCode].players.some(player => player.socketId === socket.id)) {
            return callback?.({ success: false, message: 'You are already in this room' });
        }

        if (rooms[roomCode].players.length >= rooms[roomCode].maxPlayers) {
            return callback?.({ success: false, message: 'Room is full' });
        }

        const maxPlayers = rooms[roomCode].maxPlayers;

        // Player joins the room
        rooms[roomCode].players.push({
            socketId: socket.id,
            _id: socket.user._id,
            email: socket.user.email,
            name: socket.user.name,
            isCreator: false,
            tokens: [0, 0, 0, 0],
        });
        socket.join(roomCode);

        const response = {
            success: true,
            message: "Player joined successfully.",
            data: {
                roomCode,
                maxPlayers,
                players: rooms[roomCode].players
            }
        };
        console.log('Emitting player_joined with:', response);
        io.to(roomCode).emit('player_joined', response);
        // ✅ Callback only for the joining player
        callback?.({ success: true, message: "You have successfully joined the room." });
    });

    //if desiredPlayers and maxPlayers are not same
    socket.on('confirm_join_room', ({ roomCode }, callback) => {
        console.log(`Attempting to join room: ${roomCode}`);

        if (!rooms[roomCode]) {
            return callback?.({ success: false, message: 'Invalid room code' });
        }

        if (rooms[roomCode].players.some(player => player.email === socket.user.email)) {
            return callback?.({ success: false, message: 'You are already in this room' });
        }

        if (rooms[roomCode].players.length >= rooms[roomCode].maxPlayers) {
            return callback?.({ success: false, message: 'Room is full' });
        }

        const maxPlayers = rooms[roomCode].maxPlayers;

        // Player joins the room
        rooms[roomCode].players.push({
            socketId: socket.id,
            _id: socket.user._id,
            email: socket.user.email,
            name: socket.user.name,
            isCreator: false,
            tokens: [0, 0, 0, 0],
        });
        socket.join(roomCode);

        const response = {
            success: true,
            message: "Player joined successfully.",
            data: {
                roomCode,
                maxPlayers,
                players: rooms[roomCode].players
            }
        };
        console.log('Emitting player_joined with:', response);
        io.to(roomCode).emit('player_joined', response);
        // ✅ Callback only for the joining player
        callback?.({ success: true, message: "You have successfully joined the room." });
    });

    // Remove the player from the room if they are not playing
    // Delete the room if the creator quits
    socket.on('quit_room1', ({ roomCode }, callback) => {
        if (!rooms[roomCode]) {
            return callback?.({ success: false, message: "Invalid room code." });
        }

        const room = rooms[roomCode];
        const currentPlayer = room.players.find(player => player.socketId === socket.id);

        if (!currentPlayer) {
            return callback?.({ success: false, message: 'Player not found in the room.' });
        }

        const left_player = room.players.find(player => player.email === socket.user.email);
        if (!currentPlayer.isCreator) {
            // Remove player from the room
            room.players = room.players.filter(player => player.email !== socket.user.email);

            // Ensure player leaves the room
            socket.leave(roomCode);

            console.log("room.players : ", room.players)

            io.to(roomCode).emit('player_left_room', {
                // socket.broadcast.emit(roomCode).emit('player_left_room', {
                success: true,
                message: `Player ${currentPlayer.name} has left the room.`,

                //remainig player data
                // data: {
                //     players: room.players.map(player => ({
                //         email: player.email,
                //         name: player.name,
                //         tokens: player.tokens,
                //     })),
                // },

                // left player data
                // data: {
                //     left_player.email
                // },
                email: left_player.email
            });

            callback?.({ success: true, message: "Player left the room." });

        } else {
            // Room creator quits, delete the room
            io.to(roomCode).emit('room_deleted', {
                success: true,
                message: "The room has been deleted.",
                is_deleted_by: currentPlayer.email,
                // data: null
            });
            console.log("room.players : ", room.players)
            delete rooms[roomCode];
            callback?.({ success: true, message: "Room deleted successfully." });
        }
    });

    socket.on('quit_room', ({ roomCode }, callback) => {
        if (!rooms[roomCode]) {
            return callback?.({ success: false, message: "Invalid room code." });
        }

        const room = rooms[roomCode];
        const currentPlayer = room.players.find(player => player.socketId === socket.id);

        if (!currentPlayer) {
            return callback?.({ success: false, message: 'Player not found in the room.' });
        }

        const leftPlayer = room.players.find(player => player.email === socket.user.email);

        console.log("leftPlayer : ", leftPlayer, typeof leftPlayer)
        console.log("socket.user.email : ", socket.user.email, typeof socket.user.email)

        if (!currentPlayer.isCreator) {
            // Remove the player from the room
            room.players = room.players.filter(player => player.email !== socket.user.email);
            // socket.leave(roomCode); // Player leaves the room

            console.log("Remaining players in room:", room.players);

            // Notify other players about the departure
            io.to(roomCode).emit('player_left_room', {
                success: true,
                message: `Player ${currentPlayer.name} has left the room.`,
                email: leftPlayer.email,
                _id: leftPlayer._id
            });

            // You should send the message before the socket leaves the room. Otherwise, 
            // the current socket will be removed from the group before the message is sent.
            socket.leave(roomCode); // Player leaves the room

            callback?.({ success: true, message: "Player left the room." });

        } else {
            // Room creator quits → Delete the room
            io.to(roomCode).emit('room_deleted', {
                success: true,
                message: "The room has been deleted.",
                is_deleted_by: currentPlayer.email
            });

            console.log(`Room ${roomCode} deleted by creator ${currentPlayer.email}`);

            // Remove all players and delete the room
            room.players.forEach(player => {
                io.sockets.sockets.get(player.socketId)?.leave(roomCode);
            });
            delete rooms[roomCode];

            callback?.({ success: true, message: "Room deleted successfully." });
        }
    });

    socket.on('game_start', ({ roomCode }, callback) => {
        if (!rooms[roomCode]) {
            return callback?.({ success: false, message: "Invalid room code." });
        }

        const room = rooms[roomCode];


        // Check if the room is full
        if (Number(room.maxPlayers) !== Number(room.players.length)) {
            return callback?.({ success: false, message: "The room is not full yet. Please wait for other players to join." });
        }

        const currentPlayer = rooms[roomCode].players.find(player => player.socketId === socket.id);
        if (!currentPlayer) {
            return callback?.({ success: false, message: 'Player not found in the room.' });
        }

        if (!currentPlayer.isCreator) {
            return callback?.({ success: false, message: 'Only the room creator can start the game.' });
        }

        // Emit the game started event to all players in the room
        io.to(roomCode).emit('game_started', {
            success: true,
            message: "The game has started!",
            data: {
                players: room.players.map(player => ({
                    name: player.name,
                    email: player.email,
                    _id: player._id,
                    tokens: player.tokens
                })),
                turnIndex: room.turnIndex
            }
        });

        callback?.({ success: true, message: "Game started successfully!" });
    });

    socket.on('roll_dice', ({ roomCode }, callback) => {
        const room = rooms[roomCode];
        if (!room) {
            return callback?.({ success: false, message: "Invalid room code." });
        }

        const currentPlayer = room.players[room.turnIndex];

        if (Number(room.maxPlayers) !== room.players.length) {
            return callback?.({
                success: false,
                message: "The room is not full yet. Please wait for other players to join."
            });
        }

        if (currentPlayer.socketId !== socket.id) {
            return callback?.({ success: false, message: "Not your turn!" });
        }

        if (room.lastDiceRoll !== null) {
            return callback?.({ success: false, message: "Please move the token first, then roll the dice." });
        }

        const diceRoll = Math.floor(Math.random() * 6) + 1;
        room.lastDiceRoll = diceRoll;

        const movableTokenIndexes = currentPlayer.tokens
            .map((token, index) => {
                if (token === 0 && diceRoll === 6) return index;
                if (token > 0 && token < 57 && token + diceRoll <= 57) return index;
                return -1;
            })
            .filter(index => index !== -1);

        const playersData = room.players.map(player => ({
            name: player.name,
            _id: player._id,
            email: player.email,
            tokens: player.tokens
        }));

        // ✅ Step 1: Emit dice_rolled for everyone
        io.to(roomCode).emit('dice_rolled', {
            success: true,
            message: `Player ${currentPlayer.name} rolled a ${diceRoll}`,
            data: {
                player: socket.id,
                name: currentPlayer.name,
                _id: currentPlayer._id,
                email: currentPlayer.email,
                diceValue: diceRoll,
                allPlayers: playersData
            }
        });

        // ✅ Step 2: Handle auto-move after 500ms (if exactly one movable token)
        if (movableTokenIndexes.length === 1) {
            setTimeout(() => {
                const tokenIndex = movableTokenIndexes[0];
                const oldPos = currentPlayer.tokens[tokenIndex];
                const newPos = oldPos === 0 ? 1 : oldPos + diceRoll;
                currentPlayer.tokens[tokenIndex] = newPos;

                // If not in a safe spot, kill opponent tokens
                let isKill = false;
                const safeSpots = [1, 9, 14, 22, 27, 35, 40, 48];
                if (!safeSpots.includes(newPos)) {
                    for (const player of room.players) {
                        if (player._id !== currentPlayer._id) {
                            for (let i = 0; i < player.tokens.length; i++) {
                                if (player.tokens[i] === newPos) {
                                    player.tokens[i] = 0;
                                    isKill = true;
                                }
                            }
                        }
                    }
                }

                const updatedPlayers = room.players.map(player => ({
                    name: player.name,
                    _id: player._id,
                    email: player.email,
                    tokens: player.tokens
                }));

                io.to(roomCode).emit('token_moved', {
                    success: true,
                    message: `Token ${tokenIndex} auto-moved by ${currentPlayer.email}`,
                    data: {
                        player: socket.id,
                        name: currentPlayer.name,
                        _id: currentPlayer._id,
                        email: currentPlayer.email,
                        tokenIndex,
                        newPosition: newPos,
                        allPlayers: updatedPlayers
                    }
                });

                // Only skip turn if you didn't roll 6 AND didn't kill
                if (diceRoll !== 6 && !isKill) {
                    room.turnIndex = (room.turnIndex + 1) % room.players.length;
                }

                const nextPlayer = room.players[room.turnIndex];
                room.lastDiceRoll = null;

                io.to(roomCode).emit('player_turn', {
                    success: true,
                    message: `It's now ${nextPlayer.email}'s turn.`,
                    data: {
                        nextPlayer: nextPlayer.email,
                        _id: nextPlayer._id
                    }
                });

            }, 400);
        }

        // ✅ Step 3: If no token can move, skip turn immediately
        if (movableTokenIndexes.length === 0) {
            room.turnIndex = (room.turnIndex + 1) % room.players.length;

            const nextPlayer = room.players[room.turnIndex];
            room.lastDiceRoll = null;

            io.to(roomCode).emit('player_turn', {
                success: true,
                message: `No token could move. It's now ${nextPlayer.email}'s turn.`,
                data: {
                    nextPlayer: nextPlayer.email,
                    _id: nextPlayer._id
                }
            });
        }

        // ✅ Step 4: Always respond to the original player
        callback?.({
            success: true,
            message: "Dice rolled successfully!",
            diceValue: diceRoll,
            room
        });
    });

    socket.on('move_token', ({ roomCode, tokenIndex }, callback) => {
        const room = rooms[roomCode];
        if (!room) return callback?.({ success: false, message: "Invalid room code" });

        const currentPlayer = room.players[room.turnIndex];
        if (currentPlayer.socketId !== socket.id) {
            return callback?.({ success: false, message: "It's not your turn!" });
        }

        if (tokenIndex < 0 || tokenIndex > 3) {
            return callback?.({ success: false, message: "Invalid token index" });
        }

        if (room.lastDiceRoll === null) {
            return callback?.({ success: false, message: "You must roll the dice before moving a token!" });
        }

        const currentPos = currentPlayer.tokens[tokenIndex];
        const diceRoll = room.lastDiceRoll;

        // Rules:
        if (currentPos === 0 && diceRoll !== 6) {
            return callback?.({ success: false, message: "You need a 6 to bring the token out." });
        }

        if (currentPos >= 57) {
            return callback?.({ success: false, message: "Token already finished." });
        }

        if (currentPos > 0 && currentPos + diceRoll > 57) {
            return callback?.({ success: false, message: `You need ${57 - currentPos} or less to move.` });
        }

        // Move the token
        // Token enters the board (moves from home to starting position)
        const newPos = currentPos === 0 ? 1 : currentPos + diceRoll;
        currentPlayer.tokens[tokenIndex] = newPos;

        // Define the safe spots where tokens cannot be cut
        const safeSpots = [1, 9, 14, 22, 27, 35, 40, 48];
        let isKill = false;
        // Check if the new position is not a safe spot
        if (!safeSpots.includes(newPos)) {
            // Loop through all other players
            for (const player of room.players) {
                if (player._id !== currentPlayer._id) {
                    // Check each token of the opponent player
                    for (let i = 0; i < 4; i++) {
                        // If token is on the same spot as current player's token
                        if (player.tokens[i] === newPos) {
                            player.tokens[i] = 0; // Send the opponent's token back to home
                            isKill = true;
                        }
                    }
                }
            }
        }


        // Check win condition
        const allFinished = currentPlayer.tokens.every(pos => pos === 57);
        if (allFinished) {
            io.to(roomCode).emit('game_won', {
                success: true,
                message: `${currentPlayer.name} has won the game!`,
                winner: currentPlayer.email,
                room
            });
            return;
        }

        // Broadcast token moved
        const playersData = room.players.map(player => ({
            name: player.name,
            _id: player._id,
            email: player.email,
            tokens: player.tokens
        }));

        io.to(roomCode).emit('token_moved', {
            success: true,
            message: `Player ${currentPlayer.email} moved token ${tokenIndex}.`,
            data: {
                player: socket.id,
                name: currentPlayer.name,
                _id: currentPlayer._id,
                email: currentPlayer.email,
                tokenIndex,
                newPosition: newPos,
                allPlayers: playersData
            }
        });

        // Only skip turn if you didn't roll 6 AND didn't kill
        if (diceRoll !== 6 && !isKill) {
            room.turnIndex = (room.turnIndex + 1) % room.players.length;
        }

        const nextPlayer = room.players[room.turnIndex];
        room.lastDiceRoll = null; // Reset for next player

        io.to(roomCode).emit('player_turn', {
            success: true,
            message: `It's now ${nextPlayer.email}'s turn.`,
            data: {
                nextPlayer: nextPlayer.email,
                _id: nextPlayer._id
            }
        });

        callback?.({ success: true, message: "Token moved successfully!" });
    });

    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.user.email} | Reason: ${reason}`);

        for (const [roomCode, room] of Object.entries(rooms)) {
            const playerIndex = room.players.findIndex(player => player.socketId === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1); // Remove player from the room

                if (room.players.length === 0) {
                    delete rooms[roomCode]; // Remove room if no players left
                    console.log(`Room ${roomCode} deleted due to inactivity.`);
                } else {
                    io.to(roomCode).emit('player_left', {
                        message: "A player left the game",
                        players: room.players
                    });
                }
                break;
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});