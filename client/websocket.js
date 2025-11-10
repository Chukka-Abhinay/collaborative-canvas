// WebSocket Connection Manager
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.username = null;
        this.userColor = null;
        this.users = new Map();
        this.canvasManager = null;
        this.isConnected = false;
        
        // Callbacks
        this.onUsersUpdate = null;
        this.onConnectionChange = null;
    }
    
    connect(username, canvasManager) {
        this.username = username;
        this.canvasManager = canvasManager;
        
        // Initialize Socket.io connection
        // In production, this will connect to the Vercel serverless function
        const socketUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;
            
        this.socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });
        
        // Set socket reference in canvas manager
        canvasManager.setSocket(this.socket);
        
        this.setupEventListeners();
        
        // Join with username
        this.socket.emit('join', { username });
    }
    
    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            
            // Rejoin if reconnecting
            if (this.username) {
                this.socket.emit('join', { username: this.username });
            }
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.updateConnectionStatus(false);
        });
        
        // User events
        this.socket.on('user-joined', (data) => {
            console.log('User joined:', data);
            this.userId = data.userId;
            this.userColor = data.userColor;
            
            // Set userId in canvas manager
            this.canvasManager.setUserId(data.userId);
            
            // Update UI with user info
            document.getElementById('currentUser').textContent = 
                `${data.username} (You)`;
            document.getElementById('currentUser').style.color = data.userColor;
        });
        
        this.socket.on('users-update', (users) => {
            console.log('Users update:', users);
            this.updateUsersList(users);
            this.updateCursors(users);
        });
        
        this.socket.on('user-disconnected', (userId) => {
            console.log('User disconnected:', userId);
            this.removeCursor(userId);
        });
        
        // Drawing events - updated for stroke-based system
        this.socket.on('remote-drawing-stroke', (data) => {
            if (data.userId !== this.userId) {
                this.canvasManager.drawRemoteStroke(data);
            }
        });
        
        this.socket.on('remote-drawing-batch', (data) => {
            if (data.userId !== this.userId) {
                this.canvasManager.drawRemoteBatch(data.batch);
            }
        });
        
        // Canvas state events - for initial load
        this.socket.on('initial-canvas-strokes', (data) => {
            // Load initial strokes when joining
            if (data.strokes) {
                this.canvasManager.loadCanvasStrokes(data.strokes);
            }
        });
        
        // Undo/Redo events - now stroke-based
        this.socket.on('remote-undo-stroke', (data) => {
            if (data.userId !== this.userId) {
                this.canvasManager.handleRemoteUndo(data.strokeId);
            }
        });
        
        this.socket.on('remote-redo-stroke', (data) => {
            if (data.userId !== this.userId) {
                this.canvasManager.handleRemoteRedo(data.stroke);
            }
        });
        
        this.socket.on('remote-clear-user', (data) => {
            if (data.userId !== this.userId) {
                // Remove all strokes from that user
                this.canvasManager.allStrokes = this.canvasManager.allStrokes.filter(
                    s => s.userId !== data.userId
                );
                this.canvasManager.redrawCanvas();
            }
        });
        
        this.socket.on('remote-clear-all', () => {
            // Clear entire canvas
            this.canvasManager.allStrokes = [];
            this.canvasManager.userStrokes = [];
            this.canvasManager.redoStack = [];
            this.canvasManager.redrawCanvas();
        });
        
        // Cursor events
        this.socket.on('cursor-position', (data) => {
            if (data.userId !== this.userId) {
                this.updateUserCursor(data.userId, data.x, data.y);
            }
        });
    }
    
    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (connected) {
            statusEl.textContent = 'Connected';
            statusEl.className = 'status-connected';
        } else {
            statusEl.textContent = 'Disconnected';
            statusEl.className = 'status-disconnected';
        }
        
        if (this.onConnectionChange) {
            this.onConnectionChange(connected);
        }
    }
    
    updateUsersList(users) {
        this.users = new Map(users.map(u => [u.userId, u]));
        
        const usersListEl = document.getElementById('usersList');
        const userCountEl = document.getElementById('userCount');
        
        usersListEl.innerHTML = '';
        userCountEl.textContent = users.length;
        
        users.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'user-item';
            userEl.innerHTML = `
                <span class="user-indicator" style="background-color: ${user.userColor}"></span>
                <span>${user.username}${user.userId === this.userId ? ' (You)' : ''}</span>
            `;
            usersListEl.appendChild(userEl);
        });
        
        if (this.onUsersUpdate) {
            this.onUsersUpdate(users);
        }
    }
    
    updateCursors(users) {
        users.forEach(user => {
            if (user.userId !== this.userId) {
                this.createOrUpdateCursor(user.userId, user.username, user.userColor);
            }
        });
    }
    
    createOrUpdateCursor(userId, username, color) {
        let cursor = document.getElementById(`cursor-${userId}`);
        
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.id = `cursor-${userId}`;
            cursor.className = 'user-cursor';
            cursor.style.borderColor = color;
            cursor.setAttribute('data-username', username);
            document.getElementById('cursors').appendChild(cursor);
        }
    }
    
    updateUserCursor(userId, x, y) {
        const cursor = document.getElementById(`cursor-${userId}`);
        if (cursor) {
            cursor.style.transform = `translate(${x}px, ${y}px)`;
            cursor.style.opacity = '1';
            
            // Hide cursor after inactivity
            clearTimeout(cursor.hideTimeout);
            cursor.hideTimeout = setTimeout(() => {
                cursor.style.opacity = '0';
            }, 3000);
        }
    }
    
    removeCursor(userId) {
        const cursor = document.getElementById(`cursor-${userId}`);
        if (cursor) {
            cursor.remove();
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Export for use in other modules
window.WebSocketManager = WebSocketManager;
