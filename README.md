# VASUKI INDICUS: Rise of the Ancient Serpent

A 3D voxel serpent web game featuring ancient Indian aesthetic themes, WebGL rendering powered by Three.js, and an AWS serverless global leaderboard backend.

---

## Quick Links

- **Live App (Clean Domain)**: [Play Vasuki Indicus](https://premxpagar.github.io/vasuki-indicus-game/)
- **Live App (AWS Amplify Cloud)**: [Play on AWS Amplify](https://main.d12d9hurljxv4f.amplifyapp.com/)
- **GitHub Repository**: [premxpagar/vasuki-indicus-game](https://github.com/premxpagar/vasuki-indicus-game)
- **Article (AWS Builder Center)**: [Weekend Deployment Challenge: VASUKI INDICUS](https://builder.aws.com/content/3JDuhJo5WXXxeWVHrh8Hw6OtOZn/weekend-deployment-challenge-vasuki-indicus-ancient-3d-voxel-serpent-on-aws-serverless)

---

## Overview

VASUKI INDICUS brings the legendary prehistoric serpent Vasuki Indicus into a fast-paced 3D arcade experience. Built on Three.js and WebGL, the game combines classic serpent growth mechanics with modern graphics, dynamic particle effects, custom shaders, and cloud score tracking.

### Core Features

- **3D Voxel Engine**: Real-time lighting, procedural animations, dust trails, and ambient particle systems.
- **Serpent Skins & Customization**: Switch between ancient skins such as Bronze Relic, Golden Nagavanshi, Charcoal Obsidian, and Emerald Forest.
- **Dynamic Realm Atmospheres**: Toggle atmospheric environments including Sacred Night, Dusk Ember, and Dawn Mist.
- **Serverless Global Leaderboard**: Real-time score recording and high-score ranking backed by Amazon DynamoDB, AWS Lambda, and Amazon API Gateway, with automatic local offline fallback.
- **Responsive Controls**: Full support for desktop keyboard controls, mouse interaction, and touch-based mobile navigation.

---

## Architecture Overview

The system is decoupled into a static client-side web application and an AWS serverless backend:

```
[ Web Browser Client ]
       │
       │ HTTPS JSON (REST)
       ▼
[ Amazon API Gateway (HTTP API v2) ]
       │
       │ Payload Proxy & CORS
       ▼
[ AWS Lambda (Node.js 20.x Handler) ]
       │
       │ IAM Least-Privilege Role
       ▼
[ Amazon DynamoDB (VasukiLeaderboard Table) ]
```

### Security and Design Principles

1. **Zero Client-Side Credentials**: No AWS access keys, secret keys, or IAM credentials exist in the client-side code.
2. **CORS Protected**: API Gateway handles preflight OPTIONS requests and validates accepted origins.
3. **Resilient Offline Fallback**: If network connectivity is lost or an API endpoint is unreachable, the client automatically defaults to local browser storage caching.

---

## Controls

### Desktop
- **Steer**: `W` / `A` / `S` / `D` or Arrow Keys
- **Boost Speed**: `Shift` or `Space`
- **Pause**: `P` or `Escape`
- **Restart**: `R`

### Mobile & Touch
- **Steer**: On-screen directional swipe or D-Pad controls
- **Boost**: On-screen Boost button

---

## Local Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/premxpagar/vasuki-indicus-game.git
   cd vasuki-indicus-game
   ```

2. **Run Locally**:
   Serve the root directory using any local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Or using Node.js npx serve
   npx serve .

   # Or on Windows using PowerShell
   .\launch.bat
   ```

3. **Open the Game**:
   Navigate to `http://localhost:8000` in your web browser.

---

## AWS Serverless Leaderboard Setup

To connect your own AWS cloud leaderboard:

1. Navigate to the `aws/` directory:
   ```bash
   cd aws
   ```

2. Deploy using the AWS SAM CLI:
   ```bash
   sam build
   sam deploy --guided
   ```

3. Copy the output `LeaderboardApiEndpoint` and configure `API_GATEWAY_URL` in `js/config.js`:
   ```javascript
   export const CONFIG = {
     API_GATEWAY_URL: 'https://your-api-id.execute-api.your-region.amazonaws.com',
     ...
   };
   ```

Detailed AWS deployment instructions and manual console setup steps are available in [aws/README.md](aws/README.md).

---

## Project Structure

```
vasuki-indicus-game/
├── aws/
│   ├── lambda/
│   │   └── index.js          # AWS Lambda Node.js handler
│   ├── template.yaml         # AWS SAM CloudFormation template
│   └── README.md             # AWS backend deployment guide
├── css/
│   └── styles.css            # Game styling and UI modal system
├── js/
│   ├── config.js             # Client configuration and fallback data
│   ├── Engine.js             # Three.js 3D rendering loop and scene setup
│   ├── LeaderboardService.js # AWS API Gateway client and caching
│   ├── Snake.js              # Voxel serpent kinematics and segment physics
│   ├── FoodManager.js        # Voxel apple spawner and collection logic
│   ├── Obstacles.js          # Dynamic terrain obstacles and collision bounds
│   ├── UIManager.js          # HUD, modals, score submission, leaderboard UI
│   └── ...                   # Shaders, day/night cycles, particle systems
├── .gitignore                # Git ignore rules for logs and temporary files
├── index.html                # Main game entry point
├── launch.bat                # Windows local quick launcher
├── launch.vbs                # Silent local launch helper
├── server.ps1                # Lightweight PowerShell HTTP server
├── logo.png                  # Project icon asset
├── LICENSE                   # MIT License
└── README.md                 # Project documentation
```

---

## License & Attribution

This project is licensed under the [MIT License](LICENSE).

- **Original Foundation**: Based on *BLOCK SNAKE 3D*, originally authored by Sam Wilson and Chahek Sinha.
- **Modifications & Enhancements**: Custom ancient aesthetic overhaul, voxel rendering modifications, and AWS serverless cloud leaderboard architecture created by Prem Pagar.
