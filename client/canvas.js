// Canvas Drawing Module
class CanvasManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentTool = 'brush';
        this.currentColor = '#000000';
        this.currentSize = 5;
        this.lastX = 0;
        this.lastY = 0;
        
        // User-specific history for undo/redo
        this.userStrokes = [];  // Array of all strokes by current user
        this.redoStack = [];    // Strokes that were undone
        this.allStrokes = [];   // All strokes from all users
        this.strokeIdCounter = 0;
        
        // Optimization: batch drawing points
        this.drawingBatch = [];
        this.batchTimer = null;
        
        // Track current path for smooth drawing
        this.currentPath = [];
        
        // WebSocket reference (set by websocket.js)
        this.socket = null;
        
        // User identification
        this.userId = null;
    }
    
    init(canvasId, userId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.userId = userId;
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Set initial canvas properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Store current strokes
        const tempStrokes = [...this.allStrokes];
        
        // Resize canvas
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Reset canvas properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Redraw all strokes
        this.redrawCanvas();
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.startDrawing(mouseEvent);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.draw(mouseEvent);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
        
        // Start new path
        this.currentPath = [{
            x: this.lastX,
            y: this.lastY,
            tool: this.currentTool,
            color: this.currentColor,
            size: this.currentSize
        }];
        
        // Draw initial point
        this.drawPoint(this.lastX, this.lastY);
    }
    
    draw(e) {
        if (!this.isDrawing) {
            // Send cursor position even when not drawing
            this.sendCursorPosition(e);
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        // Draw line segment
        this.drawLine(this.lastX, this.lastY, currentX, currentY);
        
        // Add to current path
        this.currentPath.push({
            x: currentX,
            y: currentY
        });
        
        // Batch the drawing data for network optimization
        this.batchDrawingData({
            type: 'draw',
            from: { x: this.lastX, y: this.lastY },
            to: { x: currentX, y: currentY },
            tool: this.currentTool,
            color: this.currentColor,
            size: this.currentSize
        });
        
        this.lastX = currentX;
        this.lastY = currentY;
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            // Create stroke object
            if (this.currentPath.length > 0) {
                const stroke = {
                    id: `${this.userId}-${Date.now()}-${this.strokeIdCounter++}`,
                    userId: this.userId,
                    path: this.currentPath,
                    tool: this.currentTool,
                    color: this.currentColor,
                    size: this.currentSize,
                    timestamp: Date.now()
                };
                
                // Add to user's strokes
                this.userStrokes.push(stroke);
                this.allStrokes.push(stroke);
                
                // Clear redo stack when new stroke is added
                this.redoStack = [];
                
                // Send to server
                if (this.socket) {
                    this.socket.emit('drawing-stroke', stroke);
                }
            }
            
            // Clear current path
            this.currentPath = [];
            
            // Flush any remaining batched data
            this.flushBatch();
        }
    }
    
    drawPoint(x, y) {
        this.ctx.save();
        
        if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = this.currentColor;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.currentSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawLine(fromX, fromY, toX, toY, color = null, size = null, tool = null) {
        this.ctx.save();
        
        tool = tool || this.currentTool;
        color = color || this.currentColor;
        size = size || this.currentSize;
        
        if (tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = color;
        }
        
        this.ctx.lineWidth = size;
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawPath(pathData) {
        if (!pathData.path || pathData.path.length < 1) return;
        
        this.ctx.save();
        
        if (pathData.tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = pathData.color;
        }
        
        this.ctx.lineWidth = pathData.size;
        this.ctx.beginPath();
        
        // Move to first point
        this.ctx.moveTo(pathData.path[0].x, pathData.path[0].y);
        
        // Draw smooth curve through points
        for (let i = 1; i < pathData.path.length; i++) {
            const point = pathData.path[i];
            this.ctx.lineTo(point.x, point.y);
        }
        
        this.ctx.stroke();
        this.ctx.restore();
    }
    
    batchDrawingData(data) {
        this.drawingBatch.push(data);
        
        // Clear existing timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        
        // Set new timer to flush batch
        this.batchTimer = setTimeout(() => this.flushBatch(), 16); // ~60fps
    }
    
    flushBatch() {
        if (this.drawingBatch.length > 0 && this.socket) {
            this.socket.emit('drawing-batch', this.drawingBatch);
            this.drawingBatch = [];
        }
    }
    
    sendCursorPosition(e) {
        if (!this.socket) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Throttle cursor updates
        if (!this.cursorThrottle) {
            this.socket.emit('cursor-move', { x, y });
            this.cursorThrottle = setTimeout(() => {
                this.cursorThrottle = null;
            }, 50); // Send cursor updates at most every 50ms
        }
    }
    
    // Remote drawing methods
    drawRemoteStroke(strokeData) {
        // Add to all strokes but not user strokes
        this.allStrokes.push(strokeData);
        
        // Draw the stroke
        this.drawStroke(strokeData);
    }
    
    drawRemoteBatch(batch) {
        batch.forEach(data => {
            if (data.type === 'draw') {
                this.drawLine(
                    data.from.x, data.from.y,
                    data.to.x, data.to.y,
                    data.color, data.size, data.tool
                );
            }
        });
    }
    
    // Draw a complete stroke
    drawStroke(strokeData) {
        if (!strokeData.path || strokeData.path.length < 1) return;
        
        this.ctx.save();
        
        if (strokeData.tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = strokeData.color;
        }
        
        this.ctx.lineWidth = strokeData.size;
        this.ctx.beginPath();
        
        // Move to first point
        this.ctx.moveTo(strokeData.path[0].x, strokeData.path[0].y);
        
        // Draw smooth curve through points
        for (let i = 1; i < strokeData.path.length; i++) {
            const point = strokeData.path[i];
            this.ctx.lineTo(point.x, point.y);
        }
        
        this.ctx.stroke();
        this.ctx.restore();
    }
    
    // Redraw entire canvas from strokes
    redrawCanvas() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw all strokes in order
        this.allStrokes.forEach(stroke => {
            this.drawStroke(stroke);
        });
    }
    
    // User-specific undo/redo
    undo() {
        if (this.userStrokes.length > 0) {
            // Remove last stroke by current user
            const lastStroke = this.userStrokes.pop();
            
            // Add to redo stack
            this.redoStack.push(lastStroke);
            
            // Remove from all strokes
            const index = this.allStrokes.findIndex(s => s.id === lastStroke.id);
            if (index !== -1) {
                this.allStrokes.splice(index, 1);
            }
            
            // Redraw canvas
            this.redrawCanvas();
            
            // Notify server
            if (this.socket) {
                this.socket.emit('undo-stroke', { strokeId: lastStroke.id });
            }
        }
    }
    
    redo() {
        if (this.redoStack.length > 0) {
            // Restore last undone stroke
            const stroke = this.redoStack.pop();
            
            // Add back to user strokes
            this.userStrokes.push(stroke);
            
            // Add back to all strokes
            this.allStrokes.push(stroke);
            
            // Redraw canvas
            this.redrawCanvas();
            
            // Notify server
            if (this.socket) {
                this.socket.emit('redo-stroke', stroke);
            }
        }
    }
    
    // Handle remote undo/redo
    handleRemoteUndo(strokeId) {
        // Remove stroke from all strokes
        const index = this.allStrokes.findIndex(s => s.id === strokeId);
        if (index !== -1) {
            this.allStrokes.splice(index, 1);
            this.redrawCanvas();
        }
    }
    
    handleRemoteRedo(strokeData) {
        // Add stroke back to all strokes
        this.allStrokes.push(strokeData);
        this.redrawCanvas();
    }
    
    clear() {
        // Only clear current user's strokes
        this.userStrokes = [];
        this.redoStack = [];
        
        // Remove user's strokes from all strokes
        this.allStrokes = this.allStrokes.filter(s => s.userId !== this.userId);
        
        // Redraw canvas
        this.redrawCanvas();
        
        // Notify server
        if (this.socket) {
            this.socket.emit('clear-user-strokes', { userId: this.userId });
        }
    }
    
    clearAll() {
        // Clear everything (admin action)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.userStrokes = [];
        this.redoStack = [];
        this.allStrokes = [];
        
        if (this.socket) {
            this.socket.emit('clear-all-canvas');
        }
    }
    
    // Load initial canvas state
    loadCanvasStrokes(strokes) {
        this.allStrokes = strokes;
        // Filter user's own strokes
        this.userStrokes = strokes.filter(s => s.userId === this.userId);
        this.redrawCanvas();
    }
    
    // Tool setters
    setTool(tool) {
        this.currentTool = tool;
    }
    
    setColor(color) {
        this.currentColor = color;
    }
    
    setSize(size) {
        this.currentSize = size;
    }
    
    setSocket(socket) {
        this.socket = socket;
    }
    
    setUserId(userId) {
        this.userId = userId;
    }
}

// Export for use in other modules
window.CanvasManager = CanvasManager;
