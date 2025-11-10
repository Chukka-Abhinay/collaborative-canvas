// Main Application Entry Point
document.addEventListener('DOMContentLoaded', () => {
    // Initialize managers
    const canvasManager = new CanvasManager();
    const wsManager = new WebSocketManager();
    
    // UI Elements
    const loginModal = document.getElementById('loginModal');
    const usernameInput = document.getElementById('usernameInput');
    const joinBtn = document.getElementById('joinBtn');
    const app = document.getElementById('app');
    
    // Tool elements
    const toolButtons = document.querySelectorAll('.tool-btn');
    const colorPicker = document.getElementById('colorPicker');
    const colorPresets = document.querySelectorAll('.color-preset');
    const brushSizeSlider = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    
    // Action buttons
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    // Login functionality
    function joinCanvas() {
        const username = usernameInput.value.trim();
        
        if (username.length < 1) {
            alert('Please enter a username');
            return;
        }
        
        if (username.length > 20) {
            alert('Username must be 20 characters or less');
            return;
        }
        
        // Hide login modal and show app
        loginModal.style.display = 'none';
        app.classList.remove('hidden');
        
        // Generate a temporary userId (will be replaced by server)
        const tempUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Initialize canvas with userId
        canvasManager.init('drawingCanvas', tempUserId);
        
        // Connect to server
        wsManager.connect(username, canvasManager);
    }
    
    joinBtn.addEventListener('click', joinCanvas);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinCanvas();
        }
    });
    
    // Focus username input on load
    usernameInput.focus();
    
    // Tool selection
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            toolButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            // Set tool in canvas manager
            const tool = btn.dataset.tool;
            canvasManager.setTool(tool);
            
            // Update cursor style
            updateCursorStyle(tool);
        });
    });
    
    // Color selection
    colorPicker.addEventListener('input', (e) => {
        canvasManager.setColor(e.target.value);
    });
    
    colorPresets.forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.dataset.color;
            colorPicker.value = color;
            canvasManager.setColor(color);
        });
    });
    
    // Brush size
    brushSizeSlider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        brushSizeValue.textContent = size;
        canvasManager.setSize(size);
        updateCursorStyle(canvasManager.currentTool);
    });
    
    // Action buttons
    undoBtn.addEventListener('click', () => {
        canvasManager.undo();
    });
    
    redoBtn.addEventListener('click', () => {
        canvasManager.redo();
    });
    
    clearBtn.addEventListener('click', () => {
        const choice = confirm('Click OK to clear only your drawings, or Cancel to see more options.');
        
        if (choice) {
            // Clear only user's drawings
            canvasManager.clear();
        } else {
            // Ask if they want to clear everything
            if (confirm('Do you want to clear the ENTIRE canvas for ALL users? This cannot be undone!')) {
                canvasManager.clearAll();
            }
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only work when not typing in input
        if (e.target.tagName === 'INPUT') return;
        
        // Ctrl/Cmd + Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            canvasManager.undo();
        }
        
        // Ctrl/Cmd + Shift + Z for redo
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
            e.preventDefault();
            canvasManager.redo();
        }
        
        // B for brush
        if (e.key === 'b' || e.key === 'B') {
            document.querySelector('[data-tool="brush"]').click();
        }
        
        // E for eraser
        if (e.key === 'e' || e.key === 'E') {
            document.querySelector('[data-tool="eraser"]').click();
        }
        
        // Number keys for quick brush size
        if (e.key >= '1' && e.key <= '9') {
            const size = parseInt(e.key) * 5;
            brushSizeSlider.value = size;
            brushSizeValue.textContent = size;
            canvasManager.setSize(size);
        }
    });
    
    // Update cursor style based on tool
    function updateCursorStyle(tool) {
        const canvas = document.getElementById('drawingCanvas');
        if (tool === 'eraser') {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }
    
    // Prevent scrolling on touch devices when drawing
    document.addEventListener('touchmove', (e) => {
        if (e.target.id === 'drawingCanvas') {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && wsManager.socket) {
            // Reconnect if needed when tab becomes visible
            if (!wsManager.isConnected) {
                wsManager.socket.connect();
            }
        }
    });
    
    // Warn before leaving page if drawing is in progress
    window.addEventListener('beforeunload', (e) => {
        if (wsManager.isConnected) {
            e.preventDefault();
            e.returnValue = 'Are you sure you want to leave? You will be disconnected from the canvas.';
        }
    });
    
    // Debug info (can be removed in production)
    if (window.location.hostname === 'localhost') {
        console.log('Running in development mode');
        
        // Add FPS counter
        let lastTime = performance.now();
        let frames = 0;
        
        function updateFPS() {
            frames++;
            const currentTime = performance.now();
            
            if (currentTime >= lastTime + 1000) {
                const fps = Math.round(frames * 1000 / (currentTime - lastTime));
                console.log(`FPS: ${fps}`);
                frames = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        }
        
        // Uncomment to enable FPS logging
        // updateFPS();
    }
});
