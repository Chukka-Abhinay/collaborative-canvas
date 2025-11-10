const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const RoomManager = require('./rooms');
const DrawingStateManager = require('./drawing-state');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS settings for Vercel deployment
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Initialize managers
const roomManager = new RoomManager();
const stateManager = new DrawingStateManager();

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        connections: roomManager.getUserCount(),
        timestamp: new Date().toISOString()
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // User joins the canvas
    socket.on('join', (data) => {
        const { username } = data;
        
        if (!username) {
            socket.emit('error', { message: 'Username is required' });
            return;
        }
        
        // Add user to room (using single global room for now)
        const roomId = 'global';
        const userInfo = roomManager.addUser(socket.id, username, roomId);
        
        // Join Socket.io room
        socket.join(roomId);
        
        // Send user their info
        socket.emit('user-joined', {
            userId: socket.id,
            username: userInfo.username,
            userColor: userInfo.color,
            roomId: roomId
        });
        
        // Send current canvas strokes to new user
        const currentStrokes = stateManager.getRoomStrokes(roomId);
        if (currentStrokes && currentStrokes.length > 0) {
            socket.emit('initial-canvas-strokes', { strokes: currentStrokes });
        }
        
        // Send updated users list to all clients in room
        const usersInRoom = roomManager.getRoomUsers(roomId);
        io.to(roomId).emit('users-update', usersInRoom);
        
        console.log(`User ${username} joined room ${roomId}`);
    });
    
    // Drawing stroke (complete stroke with user identification)
    socket.on('drawing-stroke', (strokeData) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        
        // Add user info to stroke
        const stroke = {
            ...strokeData,
            userId: socket.id,
            username: user.username,
            userColor: user.color
        };
        
        // Store stroke in state manager
        stateManager.addStroke(user.roomId, stroke);
        
        // Broadcast to all other users in the room
        socket.to(user.roomId).emit('remote-drawing-stroke', stroke);
    });
    
    // Drawing batch (optimized streaming)
    socket.on('drawing-batch', (batch) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        
        // Broadcast batch to all other users in the room
        socket.to(user.roomId).emit('remote-drawing-batch', {
            batch: batch,
            userId: socket.id,
            username: user.username,
            userColor: user.color
        });
    });
    
    // Undo stroke (user-specific)
    socket.on('undo-stroke', (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        
        // Remove stroke from state manager
        stateManager.removeStroke(user.roomId, data.strokeId);
        
        // Broadcast to others
        socket.to(user.roomId).emit('remote-undo-stroke', {
            userId: socket.id,
            strokeId: data.strokeId,
            username: user.username
        });
    });
    
    // Redo stroke (user-specific)
    socket.on('redo-stroke', (strokeData) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        
        // Add stroke back to state manager
        stateManager.addStroke(user.roomId, strokeData);
        
        // Broadcast to others
        socket.to(user.roomId).emit('remote-redo-stroke', {
            userId: socket.id,
            stroke: strokeData,
            username: user.username
        });
    });
    
    // Clear user strokes
    socket.on('clear-user-strokes', (data) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        
        // Clear user's strokes from state
        stateManager.clearUserStrokes(user.roomId, socket.id);
        
        // Broadcast to others
        socket.to(user.roomId).emit('remote-clear-user', {
            userId: socket.id,
            username: user.username
        });
    });
    
    // Clear entire canvas
    socket.on('clear-all-canvas', () => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        
        // Clear all strokes
        stateManager.clearRoomStrokes(user.roomId);
        
        // Broadcast to all users
        io.to(user.roomId).emit('remote-clear-all', {
            clearedBy: user.username
        });
    });
    
    // Cursor position
    socket.on('cursor-move', (position) => {
        const user = roomManager.getUser(socket.id);
        if (!user) return;
        
        // Update user's cursor position
        roomManager.updateUserCursor(socket.id, position);
        
        // Broadcast cursor position to others
        socket.to(user.roomId).emit('cursor-position', {
            userId: socket.id,
            username: user.username,
            x: position.x,
            y: position.y,
            color: user.color
        });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        const user = roomManager.getUser(socket.id);
        if (user) {
            // Remove user from room
            roomManager.removeUser(socket.id);
            
            // Notify others in the room
            socket.to(user.roomId).emit('user-disconnected', socket.id);
            
            // Send updated users list
            const usersInRoom = roomManager.getRoomUsers(user.roomId);
            io.to(user.roomId).emit('users-update', usersInRoom);
        }
    });
    
    // Error handling
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
