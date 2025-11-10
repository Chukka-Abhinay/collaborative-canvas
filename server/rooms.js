class RoomManager {
    constructor() {
        this.users = new Map();
        this.rooms = new Map();
        this.colorPalette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#FFD700', '#FF69B4', '#00CED1',
            '#FF8C00', '#9370DB', '#3CB371', '#FF6347', '#4682B4',
            '#D2691E', '#FF1493', '#00BFFF', '#FF4500', '#32CD32'
        ];
        this.colorIndex = 0;
    }
    generateUserId(socketId) {
        return socketId;
    }
    getNextColor() {
        const color = this.colorPalette[this.colorIndex % this.colorPalette.length];
        this.colorIndex++;
        return color;
    }
    addUser(socketId, username, roomId = 'global') {
        const user = {
            userId: this.generateUserId(socketId),
            socketId: socketId,
            username: username,
            roomId: roomId,
            color: this.getNextColor(),
            joinedAt: Date.now(),
            cursor: { x: 0, y: 0 }
        };
        this.users.set(socketId, user);
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                roomId: roomId,
                users: new Set(),
                createdAt: Date.now(),
                lastActivity: Date.now()
            });
        }
        const room = this.rooms.get(roomId);
        room.users.add(socketId);
        room.lastActivity = Date.now();
        return user;
    }
    removeUser(socketId) {
        const user = this.users.get(socketId);
        if (!user) return null;
        const room = this.rooms.get(user.roomId);
        if (room) {
            room.users.delete(socketId);
            room.lastActivity = Date.now();
            if (room.users.size === 0) {
                this.rooms.delete(user.roomId);
            }
        }
        this.users.delete(socketId);
        return user;
    }
    getUser(socketId) {
        return this.users.get(socketId);
    }
    updateUserCursor(socketId, position) {
        const user = this.users.get(socketId);
        if (user) {
            user.cursor = position;
            const room = this.rooms.get(user.roomId);
            if (room) {
                room.lastActivity = Date.now();
            }
        }
    }
    getRoomUsers(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return [];
        const users = [];
        room.users.forEach(socketId => {
            const user = this.users.get(socketId);
            if (user) {
                users.push({
                    userId: user.userId,
                    username: user.username,
                    userColor: user.color,
                    cursor: user.cursor,
                    joinedAt: user.joinedAt
                });
            }
        });
        return users;
    }
    getUserCount() {
        return this.users.size;
    }
    getRoomCount() {
        return this.rooms.size;
    }
    getRoomInfo(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        return {
            roomId: room.roomId,
            userCount: room.users.size,
            users: this.getRoomUsers(roomId),
            createdAt: room.createdAt,
            lastActivity: room.lastActivity
        };
    }
    getAllRooms() {
        const rooms = [];
        this.rooms.forEach((room, roomId) => {
            rooms.push(this.getRoomInfo(roomId));
        });
        return rooms;
    }
    cleanupInactiveRooms(maxInactiveTime = 3600000) {
        const now = Date.now();
        const roomsToDelete = [];
        this.rooms.forEach((room, roomId) => {
            if (room.users.size === 0 && (now - room.lastActivity) > maxInactiveTime) {
                roomsToDelete.push(roomId);
            }
        });
        roomsToDelete.forEach(roomId => {
            this.rooms.delete(roomId);
            console.log(`Cleaned up inactive room: ${roomId}`);
        });
        return roomsToDelete.length;
    }
    getStats() {
        const stats = {
            totalUsers: this.users.size,
            totalRooms: this.rooms.size,
            rooms: []
        };
        this.rooms.forEach((room, roomId) => {
            stats.rooms.push({
                roomId: roomId,
                userCount: room.users.size,
                createdAt: room.createdAt,
                lastActivity: room.lastActivity
            });
        });
        return stats;
    }
}

module.exports = RoomManager;
