# VASUKI INDICUS — Real-time Multiplayer Backend

This directory contains the WebSocket server for 1v1 room-code multiplayer in *Vasuki Indicus: Rise of the Ancient Serpent*.

---

## 1. Running Locally (Free & Fast)

You can run this server on your laptop/PC to play between two browser tabs or between devices on your local Wi-Fi:

```bash
cd server
npm start
```

The server will listen at `ws://localhost:3000`.

---

## 2. Deploying to AWS App Runner (Production)

AWS App Runner provides managed container hosting with automatic HTTPS/WSS and zero infrastructure configuration.

### Steps to Deploy via GitHub (Easiest):
1. Push your repository to **GitHub**.
2. Open the [AWS App Runner Console](https://console.aws.amazon.com/apprunner).
3. Click **Create service**.
4. **Source**: Select **Source code repository** -> Connect your GitHub repo.
   * **Branch**: `main`
   * **Repository directory**: `server`
5. **Build settings**:
   * **Runtime**: `Node.js 20`
   * **Build command**: `npm install`
   * **Start command**: `node server.js`
   * **Port**: `3000`
6. **Service settings**:
   * Service name: `vasuki-game-server`
   * CPU & Memory: `1 vCPU, 2 GB` (or smallest available)
   * Health check path: `/health` (Protocol: `HTTP`)
7. Click **Create & deploy**.
8. Once deployed, copy your App Runner default domain (e.g. `https://xyz123.us-east-1.awsapprunner.com`).
9. In `js/config.js`, update:
   ```javascript
   WS_SERVER_URL: 'wss://xyz123.us-east-1.awsapprunner.com'
   ```
   *(Note: use `wss://` instead of `https://` for WebSockets!)*

---

## 3. How to Keep AWS Costs at $0.00 When Not Playing

AWS App Runner charges for memory while the service is active. To ensure you **never pay when not playing**:

1. In the **AWS App Runner Console**, select your `vasuki-game-server`.
2. Under **Actions**, click **Pause Service**.
3. While paused, **App Runner charges $0.00**.
4. Whenever you and your friend want to play, click **Resume Service**!
