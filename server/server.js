const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const RoomManager = require('./rooms');
const DrawingStateManager = require('./drawing-state');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

const roomManager = new RoomManager();
const stateManager = new DrawingStateManager();

app.use(express.static(path.join(__dirname, '../client')));

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        connections: roomManager.getUserCount(),
        timestamp: new Date().toISOString()
    });
});

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    socket.on('join', (data) => {
        const { username } = data;
        if (!username) {
            socket.emit('error', { message: 'Username is required' });
            return;
        }
        const roomId = 'global';
        const userInfo = roomManager.addUser(socket.id, username, roomId);
        socket.join(roomId);
        socket.emit('user-joined', {
            userId: socket.id,
            username: userInfo.username,
            userColor: userInfo.color,
            roomId: roomId
        });
        const currentStrokes = stateManager.getRoomStrokes(roomId);
        if (currentStrokes && currentStrokes.length > 0) {
            socket.emit('initial-canvas-strokes', { strokes: currentStrokes });
        }
        const usersInRoom = roomManager.getRoomUsers(roomId);
        io.to(roomId).emit('users-update', usersInRoom);
        console.log(`User ${username} joined room ${roomId}`);
    });
    socket.on('drawing-stroke', (strokeData) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        const stroke = {
            ...strokeData,
            userId: socket.id,
            username: user.username,
            userColor: user.color
        };
        stateManager.addStroke(user.roomId, stroke);
        socket.to(user.roomId).emit('remote-drawing-stroke', stroke);
    });
    socket.on('drawing-batch', (batch) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        socket.to(user.roomId).emit('remote-drawing-batch', {
            batch: batch,
            userId: socket.id,
            username: user.username,
            userColor: user.color
        });
    });
    socket.on('undo-stroke', (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        stateManager.removeStroke(user.roomId, data.strokeId);
        socket.to(user.roomId).emit('remote-undo-stroke', {
            userId: socket.id,
            strokeId: data.strokeId,
            username: user.username
        });
    });
    socket.on('redo-stroke', (strokeData) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        stateManager.addStroke(user.roomId, strokeData);
        socket.to(user.roomId).emit('remote-redo-stroke', {
            userId: socket.id,
            stroke: strokeData,
            username: user.username
        });
    });
    socket.on('clear-user-strokes', (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        stateManager.clearUserStrokes(user.roomId, socket.id);
        socket.to(user.roomId).emit('remote-clear-user', {
            userId: socket.id,
            username: user.username
        });
    });
    socket.on('clear-all-canvas', () => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        stateManager.clearRoomStrokes(user.roomId);
        io.to(user.roomId).emit('remote-clear-all', {
            clearedBy: user.username
        });
    });
    socket.on('cursor-move', (position) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        roomManager.updateUserCursor(socket.id, position);
        socket.to(user.roomId).emit('cursor-position', {
            userId: socket.id,
            username: user.username,
            x: position.x,
            y: position.y,
            color: user.color
        });
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const user = roomManager.getUser(socket.id);
        if (user) {
            roomManager.removeUser(socket.id);
            socket.to(user.roomId).emit('user-disconnected', socket.id);
            const usersInRoom = roomManager.getRoomUsers(user.roomId);
            io.to(user.roomId).emit('users-update', usersInRoom);
        }
    });
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
});

// Start server with error handling
const PORT = process.env.PORT || 3000;

// Function to find an available port
const startServer = (port) => {
    server.listen(port, () => {
        console.log('================================================');
        console.log(`🎨 Collaborative Canvas Server Started!`);
        console.log(`🚀 Server running on port ${port}`);
        console.log(`🌐 Open http://localhost:${port} in your browser`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('================================================');
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  Port ${port} is already in use.`);
            
            // Try next port
            const nextPort = port + 1;
            console.log(`🔄 Trying port ${nextPort}...`);
            startServer(nextPort);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });
};

// Start the server
startServer(PORT);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
