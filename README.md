# Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization.

## 🚀 Features

- **Real-time Drawing Sync**: See other users' drawings as they draw in real-time
- **User Cursors**: Track where other users are drawing with colored cursors
- **Drawing Tools**: Brush and eraser with adjustable sizes
- **Color Selection**: Color picker with preset colors
- **Global Undo/Redo**: Works across all users with conflict resolution
- **User Management**: See who's online with color-coded indicators
- **Mobile Support**: Touch-enabled drawing for tablets and phones
- **Keyboard Shortcuts**: Quick access to tools and actions

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript + HTML5 Canvas API
- **Backend**: Node.js + Express
- **Real-time Communication**: Socket.io
- **Deployment**: Vercel-ready

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup Instructions

1. Clone the repository:
```bash
git clone <repository-url>
cd collaborative-canvas
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

### Development Mode
```bash
npm run dev
```
This will start the server with nodemon for auto-reloading.

## 🎮 How to Test with Multiple Users

### Local Testing
1. Start the server (`npm start`)
2. Open multiple browser windows/tabs
3. Navigate each to `http://localhost:3000`
4. Enter different usernames for each window
5. Start drawing!

### Network Testing
1. Find your local IP address:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig` or `ip addr`
2. Start the server
3. On other devices on the same network, navigate to:
   ```
   http://[YOUR-IP-ADDRESS]:3000
   ```

## ⌨️ Keyboard Shortcuts

- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `B` - Select Brush tool
- `E` - Select Eraser tool
- `1-9` - Quick brush size (multiplied by 5)

## 🚀 Deployment on Vercel

### Option 1: Using Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts to deploy

### Option 2: GitHub Integration

1. Push your code to GitHub
2. Import the repository on [Vercel Dashboard](https://vercel.com/dashboard)
3. Configure build settings:
   - Framework Preset: Other
   - Build Command: `npm run build` (or leave empty)
   - Output Directory: `./`
   - Install Command: `npm install`
4. Deploy

### Vercel Configuration

Create a `vercel.json` file in the root directory (already included):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/socket.io/(.*)",
      "dest": "/server/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/server/server.js"
    }
  ]
}
```

## 🏗️ Architecture

### Client-Side
- **canvas.js**: Handles all drawing operations and canvas management
- **websocket.js**: Manages Socket.io connections and real-time communication
- **main.js**: Initializes the app and handles UI interactions

### Server-Side
- **server.js**: Express server with Socket.io integration
- **rooms.js**: Manages user sessions and room logic
- **drawing-state.js**: Handles canvas state synchronization and history

### Data Flow
1. User draws on canvas → Canvas events captured
2. Drawing data batched and sent via WebSocket
3. Server broadcasts to other users in real-time
4. Remote clients render received drawing data
5. Canvas state saved for new users joining

## 🎯 Performance Optimizations

- **Batched Drawing Events**: Groups multiple drawing points to reduce network traffic
- **Throttled Cursor Updates**: Limits cursor position updates to 20Hz
- **Efficient Canvas Operations**: Uses optimal rendering techniques
- **Path Optimization**: Smooths drawing paths for better performance

## 🐛 Known Limitations

1. **Canvas Size**: Fixed to container size, may vary between devices
2. **History Limit**: Undo/redo limited to 50 states
3. **Large Drawings**: Performance may degrade with very complex drawings
4. **Network Latency**: Drawing smoothness depends on connection quality

## 🔧 Troubleshooting

### Connection Issues
- Check if the server is running
- Verify firewall settings allow WebSocket connections
- Try refreshing the page

### Drawing Not Syncing
- Check browser console for errors
- Ensure stable internet connection
- Verify WebSocket connection status (shown in header)

### Performance Issues
- Clear canvas if too complex
- Reduce brush size for better performance
- Use Chrome/Firefox for best compatibility

## 📊 Time Spent

- **Planning & Architecture**: 2 hours
- **Frontend Development**: 4 hours
- **Backend Development**: 3 hours
- **Testing & Debugging**: 2 hours
- **Documentation**: 1 hour
- **Total**: ~12 hours

## 📝 License

MIT License - Feel free to use this project for learning and development.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

**Note**: This is a technical assessment project demonstrating real-time collaboration, Canvas API proficiency, and WebSocket implementation skills.
