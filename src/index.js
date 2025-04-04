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
    socket.on('create_room1', ({ maxPlayers }) => {
        if (![2, 4, 6].includes(maxPlayers)) {
            socket.emit('error', { message: 'Invalid player limit. Choose 2, 4, or 6 players.' });
            return;
        }

        const roomCode = Math.floor(100000 + Math.random() * 90000000).toString();
        rooms[roomCode] = {
            players: [{ socketId: socket.id, email: socket.user.email }],
            maxPlayers,
            gameState: {}
        };

        socket.join(roomCode);
        socket.emit('room_created', { success: true, message: "Hello", roomCode, maxPlayers });
        console.log(`Room ${roomCode} created by ${socket.user.email} | Max Players: ${maxPlayers}`);
    });

    socket.on('create_room', ({ maxPlayers }, callback) => {
        if (![2, 4, 6].includes(maxPlayers)) {
            const errorResponse = {
                success: false,
                message: 'Invalid player limit. Choose 2, 4, or 6 players.',
            };
            return callback?.(errorResponse);
        }

        // Generate unique room code
        let roomCode;
        do {
            roomCode = Math.floor(100000 + Math.random() * 90000000).toString();
        } while (rooms[roomCode]); // Ensure unique room code

        // Create the room
        rooms[roomCode] = {
            players: [{
                socketId: socket.id,
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

        console.log("leftPlayer : ",leftPlayer, typeof leftPlayer)
        console.log("socket.user.email : ",socket.user.email, typeof socket.user.email)

        if (!currentPlayer.isCreator) {
            // Remove the player from the room
            room.players = room.players.filter(player => player.email !== socket.user.email);
            // socket.leave(roomCode); // Player leaves the room

            console.log("Remaining players in room:", room.players);

            // Notify other players about the departure
            io.to(roomCode).emit('player_left_room', {
                success: true,
                message: `Player ${currentPlayer.name} has left the room.`,
                email: leftPlayer.email
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
                    email: player.email,
                    name: player.name,
                    tokens: player.tokens
                })),
                turnIndex: room.turnIndex
            }
        });

        callback?.({ success: true, message: "Game started successfully!" });
    });

    socket.on('roll_dice', ({ roomCode }, callback) => {
        if (!rooms[roomCode]) {
            return callback?.({ success: false, message: "Invalid room code" });
        }

        const room = rooms[roomCode];
        const currentPlayer = room.players[room.turnIndex];

        // Check if the room is full
        if (Number(room.maxPlayers) !== Number(room.players.length)) {
            return callback?.({ success: false, message: "The room is not full yet. Please wait for other players to join." });
        }

        // Check if it's the current player's turn
        if (currentPlayer.socketId !== socket.id) {
            return callback?.({ success: false, message: "Not your turn!" });
        }

        // Generate dice roll (1-6)
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        room.lastDiceRoll = diceRoll;

        console.log(`Player ${currentPlayer.email} rolled ${diceRoll} in room ${roomCode}`);

        // Get all players' tokens
        const playersData = room.players.map(player => ({
            email: player.email,
            name: player.name,
            tokens: player.tokens
        }));

        // Notify all players about the dice roll
        io.to(roomCode).emit('dice_rolled', {

            success: true,
            message: `Player ${currentPlayer.email} rolled the dice.`,
            data: {
                player: socket.id,
                email: currentPlayer.email,
                name: currentPlayer.name,
                diceValue: diceRoll,
                allPlayers: playersData
            }
        });
        console.log("rooms", rooms);
        console.log("rooms", rooms[roomCode].players);
        callback?.({ success: true, message: "Dice rolled successfully!", diceValue: diceRoll });
    });

    socket.on('move_token', ({ roomCode, tokenIndex }, callback) => {
        if (!rooms[roomCode]) {
            return callback?.({ success: false, message: "Invalid room code" });
        }

        const room = rooms[roomCode];
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

        // Move the selected token
        currentPlayer.tokens[tokenIndex] += room.lastDiceRoll;

        console.log(`Player ${currentPlayer.email} moved token ${tokenIndex} to ${currentPlayer.tokens[tokenIndex]} in room ${roomCode}`);
        console.log("rooms", rooms[roomCode].players);

        // Get all players' tokens
        const playersData = room.players.map(player => ({
            email: player.email,
            name: player.name,
            tokens: player.tokens
        }));

        // Emit the token movement event along with all players' tokens
        io.to(roomCode).emit('token_moved', {
            success: true,
            message: `Player ${currentPlayer.email} moved token ${tokenIndex}.`,
            data: {
                player: socket.id,
                email: currentPlayer.email,
                name: currentPlayer.name,
                tokenIndex,
                newPosition: currentPlayer.tokens[tokenIndex],
                allPlayers: playersData // Include all players' token data
            }
        });

        // Reset lastDiceRoll after token move
        room.lastDiceRoll = null;

        // Update turn to the next player
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
        const nextPlayer = room.players[room.turnIndex];

        // Notify the next player
        io.to(roomCode).emit('player_turn', {
            success: true,
            message: `It's now ${nextPlayer.email}'s turn.`,
            data: {
                nextPlayer: room.players[room.turnIndex].email
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