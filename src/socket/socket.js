
const jwt = require('jsonwebtoken');
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
            // console.log("user : ", decoded)
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    function handleDiceRoll(currentPlayer) {
        // Initialize dice_rolls if not present
        if (!currentPlayer.dice || !Array.isArray(currentPlayer.dice.dice_rolls)) {
            currentPlayer.dice = { dice_rolls: [1, 1, 1] };
        }

        // Roll dice between 1–6
        let diceRoll = Math.floor(Math.random() * 6) + 1;

        // Maintain last 3 rolls
        currentPlayer.dice.dice_rolls.shift();
        currentPlayer.dice.dice_rolls.push(diceRoll);

        // Directly check if all are 6 (no helper function)
        const allSix = currentPlayer.dice.dice_rolls.length === 3 &&
            currentPlayer.dice.dice_rolls.every(val => val === 6);

        if (allSix) {
            console.log(`${currentPlayer.name} rolled 6 three times in a row!`);

            // Reset all rolls to 1
            currentPlayer.dice.dice_rolls.fill(1);

            // Re-roll between 1–5
            diceRoll = Math.floor(Math.random() * 5) + 1;

            // Update the new roll
            currentPlayer.dice.dice_rolls.shift();
            currentPlayer.dice.dice_rolls.push(diceRoll);
        }

        return diceRoll;
    };

    const COLOR_START_POSITIONS = {
        blue: 1,
        red: 14,
        green: 27,
        yellow: 40,
    };

    function getGlobalPosition(relPos, color) {
        if (relPos === 0) return -1;         // Token is still in home
        if (relPos > 51) return null;        // Token is in final stretch (winning path)

        const start = COLOR_START_POSITIONS[color]; // Starting global position for the color
        // Calculate global position on circular board (1 to 52)
        // relPos 1 means token is on start square for that color
        // Formula: (start + relPos - 2) % 52 + 1
        return ((start + relPos - 2) % 52) + 1;
    };

    const rooms = {};

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.email} | Socket ID: ${socket.id}`);

        // Creating a room with a specified player limit (2 or 4)
        socket.on('create_room', ({ maxPlayers }, callback) => {

            if (![2, 4].includes(maxPlayers)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid player limit. Choose 2 or 4 players.',
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
                    color: "blue", //playerColor
                    gameStatus: {
                        state: "active",
                        reason: null,
                        auto_moves: 5,
                        rank: 0,
                        name: socket.user.name,
                        outcome: null
                    },
                    tokens: [
                        { relPos: 0, globalPos: -1 },
                        { relPos: 0, globalPos: -1 },
                        { relPos: 0, globalPos: -1 },
                        { relPos: 0, globalPos: -1 }
                    ],
                    dice: {
                        dice_rolls: [1, 1, 1] //for checking continue 3 time six
                    },
                }],
                maxPlayers,
                gameState: {},
                turnIndex: 0,     // Tracks the current player's turn
                lastDiceRoll: null // Stores the latest dice roll value
            };

            // Creator join the room
            socket.join(roomCode);
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

            if (!rooms[roomCode]) {
                return callback?.({ success: false, is_room_code: false, message: 'Invalid room code' });
            }

            if (![2, 4].includes(desiredPlayers)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid number of desired players. Please select either 2 or 4 players.',
                };
                return callback?.(errorResponse);
            }

            // Validate desiredPlayers: It must be a positive integer
            if (!desiredPlayers || typeof desiredPlayers !== 'number' || desiredPlayers <= 0 || !Number.isInteger(desiredPlayers)) {
                return callback?.({
                    success: false,
                    message: `Invalid desiredPlayers value. It must be a positive integer.`
                });
            }

            if (desiredPlayers && rooms[roomCode].maxPlayers !== desiredPlayers) {
                return callback?.({ success: false, is_room_code: true, message: `This room is for ${rooms[roomCode].maxPlayers} players. Do you want to join?.` });
            }

            if (rooms[roomCode].players.some(player => player.email === socket.user.email)) {
                return callback?.({ success: false, message: 'You are already in this room' });
            }

            if (rooms[roomCode].players.length >= rooms[roomCode].maxPlayers) {
                return callback?.({ success: false, message: 'Room is full' });
            }

            const { maxPlayers, players } = rooms[roomCode];
            const totalPlayers = players.length;

            const playerColor =
                maxPlayers === 2 ? "green" :
                    maxPlayers === 4
                        ? totalPlayers === 1 ? "red" :
                            totalPlayers === 2 ? "green" : "yellow"
                        : null; // default case if needed


            // Player joins the room
            rooms[roomCode].players.push({
                socketId: socket.id,
                _id: socket.user._id,
                email: socket.user.email,
                name: socket.user.name,
                isCreator: false,
                color: playerColor,
                gameStatus: {
                    state: "active",
                    reason: null,
                    auto_moves: 5,
                    rank: 0,
                    name: socket.user.name,
                    outcome: null
                },
                tokens: [
                    { relPos: 0, globalPos: -1 },
                    { relPos: 0, globalPos: -1 },
                    { relPos: 0, globalPos: -1 },
                    { relPos: 0, globalPos: -1 }
                ],
                dice: {
                    dice_rolls: [1, 1, 1] //for checking continue 3 time six
                },
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
            io.to(roomCode).emit('player_joined', response);
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

            const { maxPlayers, players } = rooms[roomCode];
            const totalPlayers = players.length;

            const playerColor =
                maxPlayers === 2 ? "green" :
                    maxPlayers === 4
                        ? totalPlayers === 1 ? "red" :
                            totalPlayers === 2 ? "green" : "yellow"
                        : null; // default case if needed

            // Player joins the room
            rooms[roomCode].players.push({
                socketId: socket.id,
                _id: socket.user._id,
                email: socket.user.email,
                name: socket.user.name,
                isCreator: false,
                color: playerColor,
                gameStatus: {
                    state: "active",
                    reason: null,
                    auto_moves: 5,
                    rank: 0,
                    name: socket.user.name,
                    outcome: null
                },
                tokens: [
                    { relPos: 0, globalPos: -1 },
                    { relPos: 0, globalPos: -1 },
                    { relPos: 0, globalPos: -1 },
                    { relPos: 0, globalPos: -1 }
                ],
                dice: {
                    dice_rolls: [1, 1, 1]
                },
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
            io.to(roomCode).emit('player_joined', response);
            callback?.({ success: true, message: "You have successfully joined the room." });
        });

        // Remove the player from the room if they are not playing
        // Delete the room if the creator quits
        socket.on('quit_room', ({ roomCode }, callback) => {
            if (!rooms[roomCode]) {
                return callback?.({ success: false, message: "Invalid room code." });
            }

            const room = rooms[roomCode];
            const currentPlayer = room.players.find(player => player.email === socket.user.email);

            if (!currentPlayer) {
                return callback?.({ success: false, message: 'Player not found in the room.' });
            }

            const leftPlayer = room.players.find(player => player.email === socket.user.email);

            if (!currentPlayer.isCreator) {
                // Remove the player from the room
                room.players = room.players.filter(player => player.email !== socket.user.email);

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

            const currentPlayer = rooms[roomCode].players.find(player => player.email === socket.user.email);
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

        socket.on('quit_game', ({ roomCode }, callback) => {
            const room = rooms[roomCode];

            if (!room) {
                return callback?.({ success: false, message: "Invalid room code." });
            }

            const currentPlayer = room.players.find(
                (player) => player.email === socket.user.email
            );

            if (!currentPlayer) {
                return callback?.({ success: false, message: "Player not found in the room." });
            }

            const playerIndex = room.players.findIndex(player => player.email === currentPlayer.email);
            if (playerIndex === room.turnIndex) {
                room.turnIndex = (room.turnIndex + 1) % room.players.length;
            }
            // 🟡 Mark player as left manually
            currentPlayer.gameStatus = {
                ...currentPlayer.gameStatus,
                state: "left",
                reason: "manual",
            };

            // 🔵 Count active players
            const remainingActivePlayers = room.players.filter(
                (player) => player.gameStatus.state !== "left"
            );

            console.log("remainingActivePlayers : ", remainingActivePlayers)
            // console.log("room.players : ", room.players)

            if (remainingActivePlayers.length <= 1) {
                // 🟥 End the game — too few active players
                if (room.maxPlayers === 2) {
                    room.players.forEach(player => {
                        if (player.email === socket.user.email) {
                            player.gameStatus = {
                                _id: player._id,
                                ...player.gameStatus,
                                rank: 2,
                                outcome: "left"
                            };
                        } else {
                            player.gameStatus = {
                                _id: player._id,
                                ...player.gameStatus,
                                rank: 1,
                                outcome: "100"
                            };
                        }
                    });
                } else {
                    room.players.forEach(player => {
                        if (player.email === socket.user.email) {
                            player.gameStatus = {
                                _id: player._id,
                                ...player.gameStatus,
                                rank: 2,
                                outcome: "left"
                            };
                        } else {
                            if (player.gameStatus.state === "active") {
                                player.gameStatus = {
                                    _id: player._id,
                                    ...player.gameStatus,
                                    rank: 1,
                                    outcome: "100"
                                };
                            }
                        }
                    });
                }

                // Sort by rank and return a mapped array (if needed)
                const winningList = room.players
                    .map(player => player.gameStatus)
                    .sort((a, b) => a.rank - b.rank);
                io.to(roomCode).emit("game_over", {
                    success: true,
                    message: `The game has ended because ${currentPlayer.name} quit.`,
                    data: {
                        player_quit: {
                            email: currentPlayer.email,
                            _id: currentPlayer._id,
                        },
                        winningList,
                    }
                });

                return callback?.({
                    success: true,
                    message: "You quit the game. Game over.",
                });
            } else {
                const quitterRank = remainingActivePlayers.length + 1;
                room.players.forEach(player => {
                    if (player.email === socket.user.email) {
                        player.gameStatus = {
                            _id: player._id,
                            ...player.gameStatus,
                            rank: quitterRank,
                            outcome: "left"
                        };
                    }
                });
            }

            // 🟢 Continue game — notify others about the quit
            // playersToNotify.forEach(player => {
            //     io.to(player.socketId).emit("game_over", {
            //         success: true,
            //         message: `The game has ended because ${quittingPlayer.name} quit.`,
            //         data: {}
            //     });
            // });

            io.to(roomCode).emit("player_quit", {
                success: true,
                message: `Player ${currentPlayer.name} has quit the game.`,
                player_quit: {
                    email: currentPlayer.email,
                    _id: currentPlayer._id,
                }
            });

            return callback?.({
                success: true,
                message: "You quit the game successfully.",
            });
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

            if (currentPlayer.email !== socket.user.email) {
                return callback?.({ success: false, message: "Not your turn!" });
            }

            if (room.lastDiceRoll !== null) {
                return callback?.({ success: false, message: "Please move the token first, then roll the dice." });
            }

            const diceRoll = handleDiceRoll(currentPlayer);
            room.lastDiceRoll = diceRoll;

            const movableTokenIndexes = currentPlayer.tokens
                .map((token, index) => {
                    const relPos = token.relPos;
                    // Case 1: Token is at home and can come out
                    if (relPos === 0 && diceRoll === 6) return index;
                    // Case 2: Token is on board and within valid range to move
                    if (relPos > 0 && relPos < 57 && relPos + diceRoll <= 57) return index;
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
                    const oldToken = currentPlayer.tokens[tokenIndex];
                    const isComingOut = oldToken.relPos === 0;

                    const beforeAddValue = oldToken.relPos;
                    const newRelPos = isComingOut ? 1 : oldToken.relPos + diceRoll;
                    const afterAddValue = newRelPos;

                    let isTokenInWinBox = false;
                    if (beforeAddValue !== 57 && afterAddValue === 57) {
                        isTokenInWinBox = true;
                    }

                    const newGlobalPos = getGlobalPosition(newRelPos, currentPlayer.color);

                    // Update the token
                    currentPlayer.tokens[tokenIndex] = {
                        relPos: newRelPos,
                        globalPos: newGlobalPos
                    };

                    const safeSpots = [1, 9, 14, 22, 27, 35, 40, 48];
                    let isKill = false;

                    // Only try to kill if not in safe spot
                    if (!safeSpots.includes(newGlobalPos)) {
                        for (const player of room.players) {
                            if (player._id !== currentPlayer._id) {
                                // Count opponent tokens at that position
                                const opponentTokensAtPos = player.tokens.filter(
                                    (t) =>
                                        typeof t.globalPos === 'number' &&
                                        t.globalPos === newGlobalPos &&
                                        t.relPos > 0 &&
                                        t.relPos < 57
                                );

                                // Count our own tokens at that position
                                const ownTokensAtPos = currentPlayer.tokens.filter(
                                    (t) =>
                                        typeof t.globalPos === 'number' &&
                                        t.globalPos === newGlobalPos &&
                                        t.relPos > 0 &&
                                        t.relPos < 57
                                );

                                // Only kill if exactly one opponent token is at the position and none of our own
                                if (opponentTokensAtPos.length === 1 && ownTokensAtPos.length === 0) {
                                    // Find and kill the opponent token at that position
                                    for (let i = 0; i < player.tokens.length; i++) {
                                        const opponentToken = player.tokens[i];
                                        if (
                                            typeof opponentToken.globalPos === 'number' &&
                                            opponentToken.globalPos === newGlobalPos
                                        ) {
                                            player.tokens[i] = { relPos: 0, globalPos: -1 }; // send home
                                            isKill = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }


                    // Prepare updated players data for emit
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
                            newPosition: currentPlayer.tokens[tokenIndex],
                            allPlayers: updatedPlayers
                        }
                    });

                    // Ensure all tokens have relPos === 57 (converted to number for safety)
                    console.log("currentPlayer.tokens : ", currentPlayer.tokens)
                    const allFinished = currentPlayer.tokens.every((t, i) => {
                        const relPosNum = Number(t.relPos);
                        const isFinished = relPosNum === 57;
                        console.log(`Token ${i} -> relPos: ${t.relPos} (type: ${typeof t.relPos}), isFinished: ${isFinished}`);
                        return isFinished;
                    });

                    if (allFinished) {
                        console.log(`${currentPlayer.name} has finished all tokens!`);

                        room.players.forEach(player => {
                            if (player.email === socket.user.email) {
                                player.gameStatus = {
                                    _id: player._id,
                                    ...player.gameStatus,
                                    rank: 1,
                                    outcome: "100"
                                };
                            } else {
                                player.gameStatus = {
                                    _id: player._id,
                                    ...player.gameStatus,
                                    rank: 2,
                                    outcome: "Loss"
                                };
                            }
                        });

                        const winningList = room.players
                            .map(player => player.gameStatus)
                            .sort((a, b) => a.rank - b.rank);

                        console.log("winningList ::", winningList);

                        io.to(roomCode).emit("game_over", {
                            success: true,
                            message: `${currentPlayer.name} has won the game!`,
                            data: {
                                player_quit: {
                                    email: "",
                                    _id: "",
                                },
                                winningList,
                            }
                        });
                    }
                    // Change turn only if no 6 rolled, no kill, and token not finished
                    // if (diceRoll !== 6 && !isKill && !isTokenInWinBox) {
                    //     room.turnIndex = (room.turnIndex + 1) % room.players.length;
                    // }
                    if (diceRoll !== 6 && !isKill && !isTokenInWinBox) {

                        let nextIndex = room.turnIndex;
                        do {
                            nextIndex = (nextIndex + 1) % room.players.length;
                        } while (room.players[nextIndex].gameStatus.state === "left");
                        room.turnIndex = nextIndex;
                    }
                    room.lastDiceRoll = null;

                    const nextPlayer = room.players[room.turnIndex];
                    io.to(roomCode).emit('player_turn', {
                        success: true,
                        message: `It's now ${nextPlayer.email}'s turn.`,
                        data: {
                            nextPlayer: nextPlayer.email,
                            _id: nextPlayer._id
                        }
                    });

                }, 500);
            }

            // ✅ Step 3: No movable tokens, skip turn
            if (movableTokenIndexes.length === 0) {
                // room.turnIndex = (room.turnIndex + 1) % room.players.length;
                let nextIndex = room.turnIndex;
                do {
                    nextIndex = (nextIndex + 1) % room.players.length;
                } while (room.players[nextIndex].gameStatus.state === "left");
                room.turnIndex = nextIndex;


                room.lastDiceRoll = null;

                const nextPlayer = room.players[room.turnIndex];
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

            if (tokenIndex == null || tokenIndex === "") {
                return callback?.({ success: false, message: "token index is required" });
            }
            if (tokenIndex < 0 || tokenIndex > 3) {
                return callback?.({ success: false, message: "Invalid token index" });
            }

            if (room.lastDiceRoll === null) {
                return callback?.({ success: false, message: "You must roll the dice before moving a token!" });
            }

            const token = currentPlayer.tokens[tokenIndex];
            const diceRoll = room.lastDiceRoll;
            // console.log("token : ",token)
            const relPos = token.relPos;

            if (relPos === 0 && diceRoll !== 6) {
                return callback?.({ success: false, message: "You need a 6 to bring the token out." });
            }

            if (relPos >= 57) {
                return callback?.({ success: false, message: "Token already finished." });
            }

            if (relPos > 0 && relPos + diceRoll > 57) {
                return callback?.({ success: false, message: `You need ${57 - relPos} or less to move.` });
            }

            let isTokenInWinBox = false;
            const beforeAddValue = relPos;
            const newRelPos = relPos === 0 ? 1 : relPos + diceRoll;
            const afterAddValue = newRelPos;

            if (beforeAddValue !== 57 && afterAddValue === 57) {
                isTokenInWinBox = true;
            }

            // **Use the new getGlobalPosition function here**
            const newGlobalPos = getGlobalPosition(newRelPos, currentPlayer.color);

            currentPlayer.tokens[tokenIndex] = {
                relPos: newRelPos,
                globalPos: newGlobalPos
            };

            const safeSpots = [1, 9, 14, 22, 27, 35, 40, 48];
            let isKill = false;

            if (typeof newGlobalPos === 'number' && newGlobalPos >= 0 && !safeSpots.includes(newGlobalPos)) {
                let totalTokensAtPosition = 0;
                let opponentTokensAtPosition = [];
                let ownTokensAtPosition = 0;

                for (const player of room.players) {
                    for (let i = 0; i < 4; i++) {
                        const token = player.tokens[i];
                        if (
                            typeof token.globalPos === 'number' &&
                            token.globalPos === newGlobalPos &&
                            token.relPos > 0 &&
                            token.relPos <= 51
                        ) {
                            totalTokensAtPosition++;

                            if (player._id === currentPlayer._id) {
                                ownTokensAtPosition++;
                            } else {
                                opponentTokensAtPosition.push({ player, tokenIndex: i });
                            }
                        }
                    }
                }

                // Ludo Kill Conditions:
                if (
                    totalTokensAtPosition === 2 &&                 // Total 2 tokens at the position
                    opponentTokensAtPosition.length === 1 &&       // Only one of them is opponent's
                    ownTokensAtPosition === 1                      // And one is ours (the moving one)
                ) {
                    const { player, tokenIndex } = opponentTokensAtPosition[0];
                    player.tokens[tokenIndex] = { relPos: 0, globalPos: -1 }; // Send back to home
                    isKill = true;
                }
            }

            // Ensure all tokens have relPos === 57 (converted to number for safety)
            console.log("currentPlayer.tokens : ", currentPlayer.tokens)
            const allFinished = currentPlayer.tokens.every((t, i) => {
                const relPosNum = Number(t.relPos);
                const isFinished = relPosNum === 57;
                console.log(`Token ${i} -> relPos: ${t.relPos} (type: ${typeof t.relPos}), isFinished: ${isFinished}`);
                return isFinished;
            });

            if (allFinished) {
                console.log(`${currentPlayer.name} has finished all tokens!`);

                room.players.forEach(player => {
                    if (player.email === socket.user.email) {
                        player.gameStatus = {
                            _id: player._id,
                            ...player.gameStatus,
                            rank: 1,
                            outcome: "100"
                        };
                    } else {
                        player.gameStatus = {
                            _id: player._id,
                            ...player.gameStatus,
                            rank: 2,
                            outcome: "Loss"
                        };
                    }
                });

                const winningList = room.players
                    .map(player => player.gameStatus)
                    .sort((a, b) => a.rank - b.rank);

                console.log("winningList ::", winningList);

                io.to(roomCode).emit("game_over", {
                    success: true,
                    message: `${currentPlayer.name} has won the game!`,
                    data: {
                        player_quit: {
                            email: "",
                            _id: "",
                        },
                        winningList,
                    }
                });
            }

            // Emit token moved event to all players in room
            const playersData = room.players.map(player => ({
                name: player.name,
                _id: player._id,
                email: player.email,
                tokens: player.tokens,
                gameStatus: player.gameStatus,
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
                    newPosition: { relPos: newRelPos, globalPos: newGlobalPos },
                    allPlayers: playersData
                }
            });

            // Update turn logic
            // if (diceRoll !== 6 && !isKill && !isTokenInWinBox) {
            //     room.turnIndex = (room.turnIndex + 1) % room.players.length;
            // }
            // skip turn if player state is left
            console.log("room.turnIndex before: ", room.turnIndex)
            if (diceRoll !== 6 && !isKill && !isTokenInWinBox) {

                let nextIndex = room.turnIndex;
                do {
                    nextIndex = (nextIndex + 1) % room.players.length;
                } while (room.players[nextIndex].gameStatus.state === "left");
                room.turnIndex = nextIndex;
            }
            console.log("room.turnIndex after: ", room.turnIndex)
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
}

module.exports = { initGameSocket }