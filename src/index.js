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
            players: [{ socketId: socket.id, email: socket.user.email, isCreator: true }],
            maxPlayers,
            gameState: {},
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

    socket.on('join_room', ({ roomCode }, callback) => {
        console.log(`Attempting to join room: ${roomCode}`);

        if (!rooms[roomCode]) {
            return callback?.({ success: false, message: 'Invalid room code' });
        }

        if (rooms[roomCode].players.some(player => player.socketId === socket.id)) {
            return callback?.({ success: false, message: 'You are already in this room' });
        }

        if (rooms[roomCode].players.length >= rooms[roomCode].maxPlayers) {
            return callback?.({ success: false, message: 'Room is full' });
        }

        // Player joins the room
        rooms[roomCode].players.push({ socketId: socket.id, email: socket.user.email, isCreator: false });
        socket.join(roomCode);

        const response = {
            success: true,
            message: "Player joined successfully.",
            players: rooms[roomCode].players
        };

        console.log('Emitting player_joined with:', response);

        // ✅ Broadcast to all players in the room
        io.to(roomCode).emit('player_joined', response);

        // ✅ Callback only for the joining player
        callback?.({ success: true, message: "You have successfully joined the room." });
    });


    // Rolling Dice
    socket.on('roll_dice', ({ roomCode }) => {
        console.log("rooms ", rooms);
        if (rooms[roomCode]) {
            const diceRoll = Math.floor(Math.random() * 6) + 1;
            io.to(roomCode).emit('dice_rolled', { player: socket.id, email: socket.user.email, diceValue: diceRoll });
            console.log(`Dice rolled: ${diceRoll} in room: ${roomCode}`);
        } else {
            console.log("Invalid room:", roomCode);
        }
    });

    // Handling player disconnection
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