class WebSocketManager {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.username = null;
        this.userColor = null;
        this.users = new Map();
        this.canvasManager = null;
        this.isConnected = false;
        
        this.onUsersUpdate = null;
        this.onConnectionChange = null;
    }
    
    connect(username, canvasManager) {
        this.username = username;
        this.canvasManager = canvasManager;
        
        const socketUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;
            
        this.socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });
        
        canvasManager.setSocket(this.socket);
        
        this.setupEventListeners();
        this.socket.emit('join', { username });
    }
    
    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
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
        
        this.socket.on('user-joined', (data) => {
            console.log('User joined:', data);
            this.userId = data.userId;
            this.userColor = data.userColor;
            this.canvasManager.setUserId(data.userId);
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
        
        this.socket.on('initial-canvas-strokes', (data) => {
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
                this.canvasManager.allStrokes = this.canvasManager.allStrokes.filter(
                    s => s.userId !== data.userId
                );
                this.canvasManager.redrawCanvas();
            }
        });
        
        this.socket.on('remote-clear-all', () => {
            this.canvasManager.allStrokes = [];
            this.canvasManager.userStrokes = [];
            this.canvasManager.redoStack = [];
            this.canvasManager.redrawCanvas();
        });
        
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

window.WebSocketManager = WebSocketManager;
