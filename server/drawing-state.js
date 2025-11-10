class DrawingStateManager {
    constructor() {
        this.roomStrokes = new Map();
        this.maxStrokesPerRoom = 10000;
    }
    initRoomStrokes(roomId) {
        if (!this.roomStrokes.has(roomId)) {
            this.roomStrokes.set(roomId, []);
        }
    }
    addStroke(roomId, stroke) {
        this.initRoomStrokes(roomId);
        const strokes = this.roomStrokes.get(roomId);
        strokes.push(stroke);
        if (strokes.length > this.maxStrokesPerRoom) {
            strokes.shift();
        }
        return true;
    }
    removeStroke(roomId, strokeId) {
        const strokes = this.roomStrokes.get(roomId);
        if (!strokes) return false;
        const index = strokes.findIndex(s => s.id === strokeId);
        if (index !== -1) {
            strokes.splice(index, 1);
            return true;
        }
        return false;
    }
    getRoomStrokes(roomId) {
        return this.roomStrokes.get(roomId) || [];
    }
    clearUserStrokes(roomId, userId) {
        const strokes = this.roomStrokes.get(roomId);
        if (!strokes) return;
        const filteredStrokes = strokes.filter(s => s.userId !== userId);
        this.roomStrokes.set(roomId, filteredStrokes);
    }
    clearRoomStrokes(roomId) {
        this.roomStrokes.set(roomId, []);
    }
    cleanupRoom(roomId) {
        this.roomStrokes.delete(roomId);
    }
    getStats() {
        const stats = {
            totalRooms: this.roomStrokes.size,
            rooms: []
        };
        this.roomStrokes.forEach((strokes, roomId) => {
            const userStrokeCounts = {};
            strokes.forEach(stroke => {
                userStrokeCounts[stroke.userId] = (userStrokeCounts[stroke.userId] || 0) + 1;
            });
            stats.rooms.push({
                roomId: roomId,
                totalStrokes: strokes.length,
                userStrokeCounts: userStrokeCounts
            });
        });
        return stats;
    }
    exportRoomData(roomId) {
        const strokes = this.roomStrokes.get(roomId);
        if (!strokes) return null;
        return {
            roomId: roomId,
            strokes: strokes,
            exported: Date.now()
        };
    }
    importRoomData(data) {
        if (!data || !data.roomId) return false;
        this.roomStrokes.set(data.roomId, data.strokes || []);
        return true;
    }
}

module.exports = DrawingStateManager;
