/**
 * VASUKI INDICUS — Network Manager
 * Handles real-time WebSocket communication for 1v1 Room Multiplayer.
 */

export class NetworkManager {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.isConnected = false;
    this.roomCode = null;
    this.playerSlot = null;
    this.callbacks = {};
  }

  on(event, fn) {
    this.callbacks[event] = fn;
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event](data);
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      try {
        this.ws = new WebSocket(this.serverUrl);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.trigger('connected');
        resolve();
      };

      this.ws.onerror = (err) => {
        this.trigger('error', { message: 'Failed to connect to multiplayer game server.' });
        reject(err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.trigger('disconnected');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('Error parsing incoming message:', e);
        }
      };
    });
  }

  handleMessage(msg) {
    const { type } = msg;
    switch (type) {
      case 'ROOM_CREATED':
        this.roomCode = msg.roomCode;
        this.playerSlot = msg.slot;
        this.trigger('roomCreated', msg);
        break;

      case 'ROOM_JOINED':
        this.roomCode = msg.roomCode;
        this.playerSlot = msg.slot;
        this.trigger('roomJoined', msg);
        break;

      case 'OPPONENT_JOINED':
        this.trigger('opponentJoined', msg);
        break;

      case 'GAME_START':
        this.playerSlot = msg.yourSlot;
        this.trigger('gameStart', msg);
        break;

      case 'OPPONENT_TICK':
        this.trigger('opponentTick', msg);
        break;

      case 'APPLE_EATEN':
        this.trigger('appleEaten', msg);
        break;

      case 'LIFE_LOST':
        this.trigger('lifeLost', msg);
        break;

      case 'GAME_OVER':
        this.trigger('gameOver', msg);
        break;

      case 'REMATCH_REQUESTED':
        this.trigger('rematchRequested', msg);
        break;

      case 'REMATCH_ACCEPTED':
        this.trigger('rematchAccepted', msg);
        break;

      case 'OPPONENT_LEFT':
        this.trigger('opponentLeft', msg);
        break;

      case 'ERROR':
        this.trigger('error', msg);
        break;

      default:
        break;
    }
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  async createRoom(playerName, skin) {
    await this.connect();
    this.send('CREATE_ROOM', { playerName, skin });
  }

  async joinRoom(roomCode, playerName, skin) {
    await this.connect();
    this.send('JOIN_ROOM', { roomCode: roomCode.trim().toUpperCase(), playerName, skin });
  }

  sendTick(headPos, yaw, yOffset, isBoosting, segments, invulnerable) {
    // Compact segment representation to keep packets small and fast
    const segs = segments.map(s => ({
      x: Math.round(s.mesh.position.x * 100) / 100,
      y: Math.round(s.mesh.position.y * 100) / 100,
      z: Math.round(s.mesh.position.z * 100) / 100
    }));

    this.send('TICK', {
      headPos: {
        x: Math.round(headPos.x * 100) / 100,
        y: Math.round(headPos.y * 100) / 100,
        z: Math.round(headPos.z * 100) / 100
      },
      yaw: Math.round(yaw * 1000) / 1000,
      yOffset: Math.round(yOffset * 100) / 100,
      isBoosting: !!isBoosting,
      segments: segs,
      invulnerable: !!invulnerable
    });
  }

  eatApple(appleId) {
    this.send('EAT_APPLE', { appleId });
  }

  reportHit(reason = 'collision') {
    this.send('PLAYER_HIT', { reason });
  }

  requestRematch() {
    this.send('REQUEST_REMATCH');
  }

  leaveRoom() {
    if (this.roomCode) {
      this.send('LEAVE_ROOM');
      this.roomCode = null;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}
