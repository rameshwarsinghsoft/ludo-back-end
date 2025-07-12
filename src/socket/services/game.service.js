
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

function startGame(io, socket, rooms, { roomCode }, callback) {
    const room = rooms[roomCode];
    if (!room) {
        return callback?.({ success: false, message: "Invalid room code." });
    }

    const { players, maxPlayers, turnIndex } = room;

    if (Number(players.length) !== Number(maxPlayers)) {
        return callback?.({
            success: false,
            message: "The room is not full yet. Please wait for other players to join."
        });
    }

    const currentPlayer = players.find(player => player.email === socket.user.email);
    if (!currentPlayer) {
        return callback?.({ success: false, message: "Player not found in the room." });
    }

    if (!currentPlayer.isCreator) {
        return callback?.({ success: false, message: "Only the room creator can start the game." });
    }

    const playerData = players.map(({ name, email, _id, tokens }) => ({
        name,
        email,
        _id,
        tokens
    }));

    io.to(roomCode).emit('game_started', {
        success: true,
        message: "The game has started!",
        data: { players: playerData, turnIndex }
    });

    callback?.({ success: true, message: "Game started successfully!" });
}

function updateLastFourDiceRolls(lastFourDiceRolls, email, dice_value) {
    lastFourDiceRolls.shift(); // Remove the oldest
    lastFourDiceRolls.push({ email, dice_value }); // Add the newest
};

function checkAndResetLastDiceRoll(room, currentEmail) {
    const lastEmail = room.lastFourDiceRolls.at(-1)?.email;

    if (lastEmail === currentEmail) {
        room.lastDiceRoll = null;
    }
}

function rollDice(io, socket, rooms, { roomCode }, callback) {
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

    updateLastFourDiceRolls(room.lastFourDiceRolls, socket.user.email, diceRoll);

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
    io.in(roomCode).allSockets()
        .then((socketIds) => {
            const totalSockets = socketIds.size;
            // console.log(`Total sockets in room ${roomCode}: ${totalSockets}`);
            // console.log("Socket IDs:", [...socketIds]);
        })
        .catch((err) => {
            console.error("Error getting sockets in room:", err);
        });

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

                        // console.log("opponentTokensAtPos : ", opponentTokensAtPos)
                        // console.log("ownTokensAtPos : ", ownTokensAtPos)
                        // Only kill if exactly one opponent token is at the position and none of our own
                        if (opponentTokensAtPos.length === 1 && ownTokensAtPos.length === 1) {
                            // if (opponentTokensAtPos.length === 1 && ownTokensAtPos.length === 0) {
                            console.log("inside kill")
                            // Find and kill the opponent token at that position
                            for (let i = 0; i < player.tokens.length; i++) {
                                const opponentToken = player.tokens[i];
                                if (
                                    typeof opponentToken.globalPos === 'number' &&
                                    opponentToken.globalPos === newGlobalPos
                                ) {
                                    console.log("okay kill")
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
            // console.log("currentPlayer.tokens : ", currentPlayer.tokens)
            const allFinished = currentPlayer.tokens.every((t, i) => {
                const relPosNum = Number(t.relPos);
                const isFinished = relPosNum === 57;
                console.log(`Token ${i} -> relPos: ${t.relPos} (type: ${typeof t.relPos}), isFinished: ${isFinished}`);
                return isFinished;
            });

            if (allFinished) {
                currentPlayer.gameStatus = {
                    ...currentPlayer.gameStatus,
                    state: "won",
                };

                const remainingActiveNonWinners = room.players.filter(
                    (player) => player.gameStatus.state !== "left" && player.gameStatus.state !== "won"
                );
                console.log("remainingActiveNonWinners : remainingActiveNonWinners : : ", remainingActiveNonWinners)
                if (remainingActiveNonWinners.length <= 1) {
                    if (room.maxPlayers === 2) {
                        room.players.forEach(player => {
                            if (player.email === socket.user.email) {
                                player.gameStatus = {
                                    _id: player._id,
                                    ...player.gameStatus,
                                    rank: 1,
                                    state: "won",
                                    outcome: "100"
                                };
                            } else {
                                player.gameStatus = {
                                    _id: player._id,
                                    ...player.gameStatus,
                                    rank: 2,
                                    state: "lost",
                                    outcome: "Loss"
                                };
                            }
                        });
                    } else {
                        const totalWinners = room.players.filter(
                            player => player.gameStatus.state === "won"
                        ).length;

                        const rankOutcomeMap = {
                            3: { rank: 3, outcome: 25 },
                            2: { rank: 2, outcome: 50 },
                            1: { rank: 1, outcome: 100 },
                        };

                        const { rank = 0, outcome = 0 } = rankOutcomeMap[totalWinners] || {};

                        room.players.forEach(player => {
                            if (player.email === socket.user.email) {
                                player.gameStatus = {
                                    _id: player._id,
                                    ...player.gameStatus,
                                    rank,
                                    state: "won",
                                    outcome
                                };
                            } else {
                                if (player.gameStatus.state === "active") {
                                    player.gameStatus = {
                                        _id: player._id,
                                        ...player.gameStatus,
                                        rank: rank === 1 ? 2 : rank + 1,
                                        state: "lost",
                                        outcome: "Loss"
                                    };
                                }
                            }
                        });
                    }
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
                } else {
                    // const quitterRank = remainingActiveNonWinners.length + 1;
                    // const rankOutcomeMap = {
                    //     4: { rank: 1, outcome: 100 },
                    //     3: { rank: 2, outcome: 50 },
                    // };
                    // const { rank = 0, outcome = 0 } = rankOutcomeMap[quitterRank] || {};


                    const totalWinners = room.players.filter(
                        player => player.gameStatus.state === "won"
                    ).length;

                    const rankOutcomeMap = {
                        3: { rank: 3, outcome: 25 },
                        2: { rank: 2, outcome: 50 },
                        1: { rank: 1, outcome: 100 },
                    };

                    const { rank = 0, outcome = 0 } = rankOutcomeMap[totalWinners] || {};

                    room.players.forEach(player => {
                        if (player.email === socket.user.email) {
                            player.gameStatus = {
                                _id: player._id,
                                ...player.gameStatus,
                                rank,
                                state: "won",
                                outcome,
                            };
                        }
                    });
                }
            }
            // Change turn only if no 6 rolled, no kill, and token not finished
            // if (diceRoll !== 6 && !isKill && !isTokenInWinBox) {
            //     room.turnIndex = (room.turnIndex + 1) % room.players.length;
            // }
            console.log(`allFinished: ${allFinished}, isKill: ${isKill}, diceRoll: ${diceRoll}`);
            console.log("1 roll dice before turnIndex : ", room.turnIndex)

            if (allFinished) isTokenInWinBox = false;
            if (diceRoll !== 6 && !isKill && !isTokenInWinBox) {
                let nextIndex = room.turnIndex;
                do {
                    nextIndex = (nextIndex + 1) % room.players.length;
                } while (
                    room.players[nextIndex].gameStatus.state === "left" ||
                    room.players[nextIndex].gameStatus.state === "won"
                );
                room.turnIndex = nextIndex;
            }
            room.lastDiceRoll = null;
            console.log("1 roll dice after room turn : ", room.turnIndex)

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
        let nextIndex = room.turnIndex;
        console.log("2 roll dice before room turn : ", room.turnIndex)
        do {
            nextIndex = (nextIndex + 1) % room.players.length;
        } while (
            room.players[nextIndex].gameStatus.state === "left" ||
            room.players[nextIndex].gameStatus.state === "won"
        );
        room.turnIndex = nextIndex;
        room.lastDiceRoll = null;
        console.log("2 roll dice after room turn : ", room.turnIndex)
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

    console.warn("player : ", room.players)
    console.log("=======================================End roll dice=============================================")

    // ✅ Step 4: Always respond to the original player
    callback?.({
        success: true,
        message: "Dice rolled successfully!",
        diceValue: diceRoll,
        room
    });
}

function moveToken(io, socket, rooms, { roomCode, tokenIndex }, callback) {

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

    const newGlobalPos = getGlobalPosition(newRelPos, currentPlayer.color);

    console.log("before move : currentPlayer possition before move ", currentPlayer)
    currentPlayer.tokens[tokenIndex] = {
        relPos: newRelPos,
        globalPos: newGlobalPos
    };
    console.log("after move currentPlayer possition before move ", currentPlayer)

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

        console.log("totalTokensAtPosition : ", totalTokensAtPosition)
        console.log("opponentTokensAtPosition : ", opponentTokensAtPosition)
        console.log("ownTokensAtPosition : ", ownTokensAtPosition)
        // Ludo Kill Conditions:
        if (
            totalTokensAtPosition === 2 &&                 // Total 2 tokens at the position
            opponentTokensAtPosition.length === 1 &&       // Only one of them is opponent's
            ownTokensAtPosition === 1                      // And one is ours (the moving one)
        ) {
            console.log("condition satisfied kill oponent token")
            const { player, tokenIndex } = opponentTokensAtPosition[0];
            player.tokens[tokenIndex] = { relPos: 0, globalPos: -1 }; // Send back to home
            isKill = true;
        }
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

    console.log("move before turnIndex : ", room.turnIndex)
    console.log("diceRoll : ", diceRoll, ", isKill : ", isKill, ", isTokenInWinBox ", isTokenInWinBox)
    if (diceRoll !== 6 && !isKill && !isTokenInWinBox) {

        let nextIndex = room.turnIndex;
        do {
            nextIndex = (nextIndex + 1) % room.players.length;
        } while (
            room.players[nextIndex].gameStatus.state === "left" ||
            room.players[nextIndex].gameStatus.state === "won"
        );
        room.turnIndex = nextIndex;
    }
    console.log("move after turnIndex : ", room.turnIndex)
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

    console.warn("player : ", room.players)
    console.log("=======================================End move Token=============================================")
    callback?.({ success: true, message: "Token moved successfully!" });
}

function quitGame(io, socket, rooms, { roomCode }, callback) {

    const room = rooms[roomCode];
    if (!room) {
        return callback?.({ success: false, message: "Invalid room code." });
    }

    const { players, turnIndex, maxPlayers } = room;
    const currentPlayer = players.find(p => p.email === socket.user.email);
    if (!currentPlayer) {
        return callback?.({ success: false, message: "Player not found in the room." });
    }

    checkAndResetLastDiceRoll(room, socket.user.email);

    const playerIndex = players.findIndex(p => p.email === currentPlayer.email);
    let isPlayerTurn = playerIndex === turnIndex;

    if (isPlayerTurn) {
        let nextIndex = turnIndex;
        do {
            nextIndex = (nextIndex + 1) % room.players.length;
        } while (
            room.players[nextIndex].gameStatus.state === "left" ||
            room.players[nextIndex].gameStatus.state === "won"
        );
        room.turnIndex = nextIndex;
    }

    // Mark player as left
    currentPlayer.gameStatus = {
        ...currentPlayer.gameStatus,
        state: "left",
        reason: "manual"
    };

    // 🔵 Count active players
    const remainingActivePlayers = room.players.filter(
        (player) => player.gameStatus.state !== "left"
    );

    // console.log("remainingActivePlayers : ", remainingActivePlayers)
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

    io.to(roomCode).emit("player_quit", {
        success: true,
        message: `Player ${currentPlayer.name} has quit the game.`,
        data: {
            player_quit: {
                email: currentPlayer.email,
                _id: currentPlayer._id,
                isPlayerTurn
            }
        }
    });

    const nextPlayer = room.players[room.turnIndex];
    io.to(roomCode).emit('player_turn', {
        success: true,
        message: `It's now ${nextPlayer.email}'s turn.`,
        data: {
            nextPlayer: nextPlayer.email,
            _id: nextPlayer._id
        }
    });

    return callback?.({
        success: true,
        message: "You quit the game successfully.",
    });
}

module.exports = {
    startGame,
    rollDice,
    moveToken,
    quitGame
};
