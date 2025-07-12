require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { initGameSocket } = require('./src/socket/socket');
const port = process.env.PORT || 8000;

const server = http.createServer(app);

// const io = new Server(server, {
//     cors: {
//         origin: '*',
//         methods: ['GET', 'POST'],
//     },
//     // connectionStateRecovery: {
//     //     maxRetries: 5,  // How many times the server should retry a failed connection
//     //     recoveryTimeout: 5000,  // How long to wait between retries (in milliseconds)
//     // }
// });
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    // transports: ['websocket'],      // ✅ Force WebSocket only, polling se problem hoti hai
    transports: ['polling', 'websocket'], // ✅ Allow both temporarily
    pingInterval: 25000,            // ✅ Mobile ke liye heartbeat ka interval
    pingTimeout: 60000              // ✅ Mobile client ko timeout se bachane ke liye
});


initGameSocket(io);

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});