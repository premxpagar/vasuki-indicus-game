import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 3000;

// HTTP Server for AWS App Runner health check
const server = http.createServer((req, res) => {
  // App Runner sends health check requests to / or /health
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 'ok', service: 'Vasuki Indicus Game Server', time: Date.now() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

// Active game rooms map: roomCode -> roomData
const rooms = new Map();

// Helper to generate 5-character friendly room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing letters like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Generate random apple coordinate within arena bounds [-32, 32]
function generateAppleCoord(existingApples = []) {
  const minR = 4;
  const maxR = 30;
  let attempts = 0;
  while (attempts < 20) {
    attempts++;
    const x = Math.round((Math.random() * 2 - 1) * maxR);
    const z = Math.round((Math.random() * 2 - 1) * maxR);
    // Don't spawn right on player spawn points
    if (Math.abs(x - 16) < 4 && Math.abs(z) < 4) continue;
    if (Math.abs(x + 16) < 4 && Math.abs(z) < 4) continue;
    // Don't spawn on other apples
    const tooClose = existingApples.some(a => Math.hypot(a.x - x, a.z - z) < 3.5);
    if (!tooClose) {
      return { x, y: 0.5, z };
    }
  }
  return { x: 0, y: 0.5, z: 0 };
}

function sendJson(ws, type, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function broadcastRoom(room, type, data = {}, excludeWs = null) {
  room.players.forEach(p => {
    if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({ type, ...data }));
    }
  });
}

function handleStartMatch(room) {
  room.state = 'playing';
  
  // Reset lives and scores
  room.players.forEach((p, idx) => {
    p.lives = 3;
    p.score = 0;
    p.slot = idx + 1; // 1 or 2
    p.rematchRequested = false;
    p.invulnerableUntil = Date.now() + 3000; // 3 sec initial invulnerability
  });

  // Spawn initial 5 apples
  room.apples = [];
  for (let i = 0; i < 5; i++) {
    const pos = generateAppleCoord(room.apples);
    room.apples.push({
      id: `apple_${Date.now()}_${i}`,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      type: 'apple'
    });
  }

  const p1 = room.players[0];
  const p2 = room.players[1];

  // Notify Player 1
  sendJson(p1.ws, 'GAME_START', {
    yourSlot: 1,
    spawn: { x: -16, y: 0.5, z: 0, yaw: Math.PI / 2 },
    opponent: { name: p2.name, skin: p2.skin, slot: 2 },
    apples: room.apples,
    lives: 3
  });

  // Notify Player 2
  sendJson(p2.ws, 'GAME_START', {
    yourSlot: 2,
    spawn: { x: 16, y: 0.5, z: 0, yaw: -Math.PI / 2 },
    opponent: { name: p1.name, skin: p1.skin, slot: 1 },
    apples: room.apples,
    lives: 3
  });
}

function evaluateGameOver(room, reason) {
  if (room.state === 'gameover') return;
  room.state = 'gameover';

  const p1 = room.players[0];
  const p2 = room.players[1];

  let winnerSlot = 'draw';
  let winnerName = 'Sacred Draw';

  if (p1.score > p2.score) {
    winnerSlot = 1;
    winnerName = p1.name;
  } else if (p2.score > p1.score) {
    winnerSlot = 2;
    winnerName = p2.name;
  } else {
    // If score tied, player with remaining lives wins
    if (p1.lives > p2.lives) {
      winnerSlot = 1;
      winnerName = p1.name;
    } else if (p2.lives > p1.lives) {
      winnerSlot = 2;
      winnerName = p2.name;
    }
  }

  broadcastRoom(room, 'GAME_OVER', {
    winnerSlot,
    winnerName,
    reason,
    p1: { name: p1.name, score: p1.score, lives: p1.lives },
    p2: { name: p2.name, score: p2.score, lives: p2.lives }
  });
}

wss.on('connection', (ws) => {
  let currentRoomCode = null;
  let playerObj = null;

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw);
      const { type } = msg;

      // 1. CREATE ROOM
      if (type === 'CREATE_ROOM') {
        const code = generateRoomCode();
        playerObj = {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ws,
          name: (msg.playerName || 'Ancient Serpent').trim().slice(0, 16),
          skin: msg.skin || 'emerald',
          slot: 1,
          lives: 3,
          score: 0,
          rematchRequested: false
        };

        const room = {
          code,
          state: 'waiting',
          players: [playerObj],
          apples: []
        };

        rooms.set(code, room);
        currentRoomCode = code;

        sendJson(ws, 'ROOM_CREATED', {
          roomCode: code,
          slot: 1
        });
        return;
      }

      // 2. JOIN ROOM
      if (type === 'JOIN_ROOM') {
        const code = (msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);

        if (!room) {
          sendJson(ws, 'ERROR', { message: `Realm code "${code}" not found.` });
          return;
        }

        if (room.players.length >= 2) {
          sendJson(ws, 'ERROR', { message: `Realm "${code}" is already full.` });
          return;
        }

        playerObj = {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ws,
          name: (msg.playerName || 'Companion Naga').trim().slice(0, 16),
          skin: msg.skin || 'gold',
          slot: 2,
          lives: 3,
          score: 0,
          rematchRequested: false
        };

        room.players.push(playerObj);
        currentRoomCode = code;

        sendJson(ws, 'ROOM_JOINED', {
          roomCode: code,
          slot: 2,
          opponent: { name: room.players[0].name, skin: room.players[0].skin }
        });

        // Notify host that guest has joined
        sendJson(room.players[0].ws, 'OPPONENT_JOINED', {
          opponent: { name: playerObj.name, skin: playerObj.skin }
        });

        // Start match
        setTimeout(() => {
          handleStartMatch(room);
        }, 1000);

        return;
      }

      // Ensure room exists for gameplay messages
      if (!currentRoomCode || !rooms.has(currentRoomCode)) return;
      const room = rooms.get(currentRoomCode);

      // 3. PLAYER POSITION TICK (Relayed to opponent at 25Hz)
      if (type === 'TICK') {
        broadcastRoom(room, 'OPPONENT_TICK', {
          slot: playerObj.slot,
          headPos: msg.headPos,
          yaw: msg.yaw,
          yOffset: msg.yOffset,
          isBoosting: msg.isBoosting,
          segments: msg.segments,
          invulnerable: msg.invulnerable
        }, ws);
        return;
      }

      // 4. APPLE EATEN
      if (type === 'EAT_APPLE') {
        const { appleId } = msg;
        const appleIndex = room.apples.findIndex(a => a.id === appleId);
        if (appleIndex !== -1) {
          room.apples.splice(appleIndex, 1);
          playerObj.score += 10;

          // Spawn new replacement apple
          const newPos = generateAppleCoord(room.apples);
          const newApple = {
            id: `apple_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            x: newPos.x,
            y: newPos.y,
            z: newPos.z,
            type: 'apple'
          };
          room.apples.push(newApple);

          // Broadcast to both players
          broadcastRoom(room, 'APPLE_EATEN', {
            appleId,
            bySlot: playerObj.slot,
            score: playerObj.score,
            newApple
          });
        }
        return;
      }

      // 5. PLAYER HIT / LIFE LOST
      if (type === 'PLAYER_HIT') {
        if (room.state !== 'playing') return;

        // Check if player is currently in invulnerability grace
        if (Date.now() < playerObj.invulnerableUntil) return;

        playerObj.lives = Math.max(0, playerObj.lives - 1);
        playerObj.invulnerableUntil = Date.now() + 3000; // 3-second respawn protection

        const respawnPos = playerObj.slot === 1
          ? { x: -16, y: 0.5, z: 0, yaw: Math.PI / 2 }
          : { x: 16, y: 0.5, z: 0, yaw: -Math.PI / 2 };

        broadcastRoom(room, 'LIFE_LOST', {
          slot: playerObj.slot,
          remainingLives: playerObj.lives,
          reason: msg.reason || 'collision',
          respawnPos
        });

        // Check if game over condition met (lives <= 0)
        if (playerObj.lives <= 0) {
          evaluateGameOver(room, `${playerObj.name} has fallen!`);
        }
        return;
      }

      // 6. REQUEST REMATCH
      if (type === 'REQUEST_REMATCH') {
        playerObj.rematchRequested = true;
        const otherPlayer = room.players.find(p => p !== playerObj);

        if (otherPlayer && otherPlayer.rematchRequested) {
          // Both agreed to rematch!
          broadcastRoom(room, 'REMATCH_ACCEPTED');
          setTimeout(() => {
            handleStartMatch(room);
          }, 800);
        } else {
          broadcastRoom(room, 'REMATCH_REQUESTED', { slot: playerObj.slot });
        }
        return;
      }

      // 7. LEAVE ROOM
      if (type === 'LEAVE_ROOM') {
        broadcastRoom(room, 'OPPONENT_LEFT', {}, ws);
        rooms.delete(currentRoomCode);
        currentRoomCode = null;
        return;
      }

    } catch (err) {
      console.error('Server error handling message:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomCode && rooms.has(currentRoomCode)) {
      const room = rooms.get(currentRoomCode);
      broadcastRoom(room, 'OPPONENT_LEFT', {}, ws);
      rooms.delete(currentRoomCode);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[VASUKI MULTIPLAYER SERVER] Running on port ${PORT}`);
  console.log(`[VASUKI MULTIPLAYER SERVER] WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`[VASUKI MULTIPLAYER SERVER] Healthcheck endpoint: http://localhost:${PORT}/health`);
});
