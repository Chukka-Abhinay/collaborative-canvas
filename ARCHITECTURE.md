# Architecture Documentation

## System Overview

The Collaborative Canvas is a real-time drawing application built with a client-server architecture using WebSockets for bidirectional communication.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT A                            │
├─────────────────────────────────────────────────────────────┤
│  User Input → Canvas Events → Drawing Manager → WebSocket   │
│       ↑                             ↓                ↓      │
│   Canvas Render ← Drawing Manager ← WebSocket ← Server      │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                          SERVER                             │
├─────────────────────────────────────────────────────────────┤
│   Socket.io Hub → Room Manager → State Manager              │
│        ↓               ↓              ↓                     │
│   Broadcast → User Management → Canvas State                │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT B                            │
├─────────────────────────────────────────────────────────────┤
│  Remote Events ← WebSocket ← Server                         │
│       ↓                                                     │
│  Canvas Render ← Drawing Manager                            │
└─────────────────────────────────────────────────────────────┘
```

## WebSocket Protocol

### Client → Server Messages

#### 1. **join**
```javascript
{
  username: string  // User's display name
}
```

#### 2. **drawing-path**
Complete drawing stroke
```javascript
{
  path: Array<{x, y}>,  // Array of points
  tool: 'brush' | 'eraser',
  color: string,        // Hex color
  size: number          // Brush size
}
```

#### 3. **drawing-batch**
Optimized streaming updates
```javascript
[
  {
    type: 'draw',
    from: {x, y},
    to: {x, y},
    tool: string,
    color: string,
    size: number
  },
  ...
]
```

#### 4. **canvas-state**
Full canvas state for synchronization
```javascript
{
  state: string,        // Base64 encoded canvas data
  timestamp: number     // Unix timestamp
}
```

#### 5. **cursor-move**
```javascript
{
  x: number,
  y: number
}
```

#### 6. **undo-action** / **redo-action**
```javascript
{
  step: number  // History step index
}
```

#### 7. **clear-canvas**
No payload required

### Server → Client Messages

#### 1. **user-joined**
```javascript
{
  userId: string,
  username: string,
  userColor: string,    // Assigned color
  roomId: string
}
```

#### 2. **users-update**
```javascript
[
  {
    userId: string,
    username: string,
    userColor: string,
    cursor: {x, y},
    joinedAt: number
  },
  ...
]
```

#### 3. **remote-drawing-path**
```javascript
{
  path: Array<{x, y}>,
  tool: string,
  color: string,
  size: number,
  userId: string,
  username: string,
  userColor: string
}
```

#### 4. **remote-drawing-batch**
```javascript
{
  batch: Array<DrawingData>,
  userId: string,
  username: string,
  userColor: string
}
```

#### 5. **cursor-position**
```javascript
{
  userId: string,
  username: string,
  x: number,
  y: number,
  color: string
}
```

#### 6. **initial-canvas-state**
```javascript
{
  state: string  // Base64 canvas data
}
```

#### 7. **remote-undo** / **remote-redo** / **remote-clear**
```javascript
{
  userId: string,
  username: string
}
```

## Undo/Redo Strategy

### Global History Management

1. **Local History Stack**
   - Each client maintains a history stack of canvas states
   - Limited to 50 states to prevent memory issues
   - Uses ImageData for efficient storage

2. **Server Synchronization**
   - Server maintains the authoritative canvas state
   - Broadcasts undo/redo actions to all clients
   - Handles conflict resolution

3. **Conflict Resolution Algorithm**
```
IF user_A performs undo THEN
  IF last_action was by user_A THEN
    Allow undo
    Broadcast to all clients
  ELSE IF last_action was by user_B THEN
    Check for conflicts
    IF no overlapping area THEN
      Allow undo with merge
    ELSE
      Reject with conflict message
  END
END
```

### State Synchronization Process

1. User performs action → Canvas updated locally
2. State snapshot taken → Compressed to base64
3. State sent to server → Server updates master state
4. Server broadcasts action to other clients
5. Clients apply action → Update their canvas

## Performance Decisions

### 1. **Drawing Optimization**

**Batching Strategy**
- Collect drawing events for 16ms (60fps)
- Send as single batch to reduce network overhead
- Smooth path interpolation on receive

**Why**: Reduces WebSocket messages from 60+/second to ~10/second per user

### 2. **Cursor Throttling**

**Implementation**
- Cursor updates throttled to 20Hz (every 50ms)
- Position interpolated on client for smooth movement

**Why**: Prevents cursor update flooding while maintaining smooth UX

### 3. **Canvas Rendering**

**Techniques Used**
- Direct pixel manipulation with ImageData
- Incremental drawing (only new strokes)
- Off-screen buffering for complex operations

**Why**: Minimizes full canvas redraws, improving performance

### 4. **State Compression**

**Approach**
- Canvas state converted to PNG data URL
- Compressed automatically by browser
- Only sent on significant changes

**Why**: Reduces bandwidth usage by ~70% compared to raw pixel data

### 5. **Memory Management**

**Strategies**
- Limited history stack (50 states)
- Automatic cleanup of disconnected users
- Room cleanup after inactivity

**Why**: Prevents memory leaks in long-running sessions

## Conflict Resolution

### Simultaneous Drawing

**Problem**: Two users draw in the same area simultaneously

**Solution**: 
- Last-write-wins approach for simplicity
- Each stroke timestamped
- Server orders by receipt time
- Clients apply in received order

### Global Undo/Redo Conflicts

**Problem**: User A undoes while User B is drawing

**Solution**:
1. Undo only affects user's own actions by default
2. Global undo requires no active drawings
3. Server maintains action ownership
4. Conflict notifications shown to users

### Network Latency Handling

**Problem**: Drawing appears delayed or jumpy

**Solutions**:
1. **Client-side Prediction**
   - Draw immediately on local canvas
   - Don't wait for server confirmation
   
2. **Interpolation**
   - Smooth paths between received points
   - Use quadratic curves for natural lines

3. **Reconciliation**
   - Server state is authoritative
   - Client adjusts if discrepancies detected

## Scalability Considerations

### Current Architecture Limits
- Single server instance: ~100 concurrent users
- Single room model: All users in same space
- Memory-based state: No persistence

### Scaling Strategies

1. **Horizontal Scaling**
   - Use Redis for session management
   - Implement room-based sharding
   - Load balance WebSocket connections

2. **State Persistence**
   - Add database for canvas snapshots
   - Implement periodic state saves
   - Enable session recovery

3. **Performance Optimization**
   - Implement canvas tiling for large drawings
   - Add level-of-detail rendering
   - Use WebRTC for peer-to-peer drawing

## Security Considerations

### Current Implementation
- No authentication (demo purposes)
- Client-side validation only
- No rate limiting

### Production Recommendations
1. Add JWT authentication
2. Implement rate limiting per user
3. Validate all drawing commands server-side
4. Sanitize usernames and limit length
5. Add CORS configuration
6. Implement drawing size limits

## Error Handling

### Connection Failures
- Automatic reconnection with exponential backoff
- State recovery on reconnect
- User notification of connection status

### Invalid Operations
- Graceful degradation for unsupported features
- Error messages for user actions
- Fallback to polling if WebSocket fails

### State Corruption
- Periodic state validation
- Full state refresh capability
- Checksum verification for critical updates

---

## Future Enhancements

1. **Layers System**: Independent drawing layers
2. **Room Persistence**: Save and load drawing sessions
3. **Advanced Tools**: Shapes, text, image import
4. **Permission System**: Read-only viewers, moderators
5. **Recording**: Replay drawing sessions
6. **Mobile Optimization**: Better touch controls
7. **Collaboration Features**: Comments, annotations
