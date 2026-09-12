import { Engine } from './Engine.js';
import { CameraManager } from './CameraManager.js';
import { Snake, SNAKE_SKINS } from './Snake.js';
import { FoodManager } from './FoodManager.js';
import { Obstacles } from './Obstacles.js';
import { AudioSystem } from './AudioSystem.js';
import { UIManager } from './UIManager.js';
import { REALM_PRESETS } from './DayNightCycle.js';
import { SkinPreviewRenderer } from './SkinPreviewRenderer.js';
import { LeaderboardService } from './LeaderboardService.js';

class GameApp {
  constructor() {
    this.gameState = 'LOADING';
    this.gameMode = 'CAMPAIGN';
    this.skinPreview = null;

    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('vasuki_indicus_highscore') || '0', 10);
    this.sector = 1;
    this.coresCollected = 0;
    this.sectorCoreTarget = 15;

    this.nitroEnergy = 100;
    this.maxNitro = 100;
    this.isBoosting = false;

    this.jumpEnergy = 100;
    this.jumpCooldownSpeed = 25;

    this.overclockTimer = 0;
    this.scoreMultiplier = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.applesEaten = 0;

    this.keysPressed = {};
    this.touchSteering = 0;
    this.touchBoosting = false;
    this.isTouchUI = false;
    this.pausedForSettings = false;
    this.resumeGrace = false;

    // Begin async initialization
    this.init();
  }
  
  updateLoading(pct, text) {
      document.getElementById('loading-bar').style.width = pct + '%';
      document.getElementById('loading-text').textContent = text;
  }

  async init() {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    
    this.updateLoading(10, 'Summoning the Realm...');
    await sleep(20);
    const container = document.getElementById('game-container');
    this.engine = new Engine(container);

    this.updateLoading(30, 'Shaping the Ancient Lands...');
    await sleep(20);
    this.cameraManager = new CameraManager(this.engine.camera);
    
    this.updateLoading(50, 'Awakening Sacred Sounds...');
    await sleep(20);
    this.audioSystem = new AudioSystem();

    this.updateLoading(65, 'Forging the Great Serpent...');
    await sleep(20);
    this.snake = new Snake(this.engine.scene, this.audioSystem);

    this.updateLoading(85, 'Placing Offerings & Obstacles...');
    await sleep(20);
    this.foodManager = new FoodManager(this.engine.scene);
    this.obstacles = new Obstacles(this.engine.scene);
    this.foodManager.setContext(
      () => this.snake.headPos,
      () => this.obstacles.getBlockerPositions()
    );
    this.uiManager = new UIManager();

    this.updateLoading(100, 'The Serpent Awakens!');
    await sleep(250);

    document.getElementById('loading-screen').classList.add('hidden');
    this.gameState = 'START_SCREEN';
    
    this.setupInputs();
    this.setupUIButtons();
    const gfxBtn = document.getElementById('settings-graphics-btn');
    if (gfxBtn && this.engine.quality) gfxBtn.textContent = this.engine.quality;

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      // If user is typing in an input or textarea, DO NOT intercept hotkeys or restart the game
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        if (e.code === 'Enter' && e.target.id === 'leaderboard-player-name') {
          document.getElementById('leaderboard-submit-btn')?.click();
        }
        return;
      }

      this.keysPressed[e.code] = true;
      this.audioSystem.init();

      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        const skinModal = document.getElementById('skin-screen');
        if (skinModal && !skinModal.classList.contains('hidden')) {
          document.getElementById('close-skin-btn')?.click();
          return;
        }
        const realmModal = document.getElementById('realm-screen');
        if (realmModal && !realmModal.classList.contains('hidden')) {
          document.getElementById('close-realm-btn')?.click();
          return;
        }
        const leaderboardModal = document.getElementById('leaderboard-screen');
        if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
          document.getElementById('close-leaderboard-btn')?.click();
          return;
        }
        const settings = document.getElementById('settings-screen');
        if (settings && !settings.classList.contains('hidden')) {
          settings.classList.add('hidden');
          this.closeSettings();
          return;
        }
        this.togglePause();
      }
      if (e.code === 'KeyR' && this.gameState === 'GAME_OVER') {
        this.restartGame();
      }
      if (e.code === 'Space' && this.gameState === 'PLAYING') {
        this.tryJump();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.code] = false;
    });

    document.addEventListener('touchmove', (e) => {
      if (this.gameState === 'PLAYING') e.preventDefault();
    }, { passive: false });

    this.setupTouchControls();
  }

  setupTouchControls() {
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const narrowScreen = Math.min(window.innerWidth, window.innerHeight) < 900;

    this.isTouchUI = hasTouch && (isMobileUserAgent || coarsePointer || narrowScreen);
    if (!this.isTouchUI) return;

    document.body.classList.add('touch-ui');

    const stick = document.getElementById('joystick-stick');
    const zone = document.getElementById('joystick-zone');
    if (!zone || !stick) return;

    const DEADZONE = 0.22;
    const SENSITIVITY = 0.62;
    let touchId = null;

    const resetStick = () => {
      touchId = null;
      stick.style.transform = 'translate(-50%, -50%)';
      this.touchSteering = 0;
    };

    const applyStick = (clientX, clientY) => {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const maxR = rect.width * 0.32;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      const nx = dx / maxR;
      const absX = Math.abs(nx);
      if (absX <= DEADZONE) {
        this.touchSteering = 0;
        return;
      }
      const scaled = (absX - DEADZONE) / (1 - DEADZONE);
      this.touchSteering = Math.sign(nx) * Math.pow(scaled, 1.35) * SENSITIVITY;
    };

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.gameState !== 'PLAYING') return;
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      applyStick(touch.clientX, touch.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchId) applyStick(touch.clientX, touch.clientY);
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchId) resetStick();
      }
    };

    zone.addEventListener('touchend', endTouch);
    zone.addEventListener('touchcancel', endTouch);

    const bindHold = (el, on, off) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.gameState === 'PLAYING') on();
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        off();
      }, { passive: false });
      el.addEventListener('touchcancel', off);
    };

    const boostBtn = document.getElementById('touch-boost-btn');
    bindHold(
      boostBtn,
      () => {
        this.touchBoosting = true;
        boostBtn.classList.add('pressed');
      },
      () => {
        this.touchBoosting = false;
        boostBtn.classList.remove('pressed');
      }
    );

    const jumpBtn = document.getElementById('touch-jump-btn');
    bindHold(
      jumpBtn,
      () => {
        this.tryJump();
        jumpBtn.classList.add('pressed');
      },
      () => jumpBtn.classList.remove('pressed')
    );
  }

  setupUIButtons() {
    document.getElementById('start-campaign-btn').addEventListener('click', () => {
      this.gameMode = 'CAMPAIGN';
      this.startGame();
    });

    document.getElementById('start-endless-btn').addEventListener('click', () => {
      this.gameMode = 'ENDLESS';
      this.startGame();
    });

    document.getElementById('resume-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.gameState === 'PAUSED') this.togglePause();
    });

    document.getElementById('restart-pause-btn').addEventListener('click', () => {
      this.restartGame();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      this.restartGame();
    });

    // Home Button Handlers (HUD, Pause Screen, Game Over Screen)
    document.getElementById('hud-home-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.goToHome();
    });

    document.getElementById('home-pause-btn')?.addEventListener('click', () => {
      this.goToHome();
    });

    document.getElementById('home-gameover-btn')?.addEventListener('click', () => {
      this.goToHome();
    });

    const audioBtn = document.getElementById('audio-toggle-btn');
    const audioIcon = document.getElementById('audio-icon');
    if (audioBtn && audioIcon) {
      audioBtn.addEventListener('click', () => {
        const isUnmuted = this.audioSystem.toggleAudio();
        audioIcon.textContent = isUnmuted ? '🔊' : '🔇';
      });
    }

    document.getElementById('pause-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.gameState === 'PLAYING') this.togglePause();
    });

    document.getElementById('settings-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openSettings();
    });

    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
      this.closeSettings();
    });

    document.getElementById('settings-audio-btn')?.addEventListener('click', (e) => {
        const isOn = e.target.textContent === 'ON';
        e.target.textContent = isOn ? 'OFF' : 'ON';
        const isUnmuted = this.audioSystem.toggleAudio();
        if (audioIcon) audioIcon.textContent = isUnmuted ? '🔊' : '🔇';
    });

    document.getElementById('settings-graphics-btn')?.addEventListener('click', (e) => {
        const states = ['LOW', 'MED', 'ULTRA'];
        let idx = states.indexOf(e.target.textContent);
        idx = (idx + 1) % states.length;
        e.target.textContent = states[idx];
        this.engine.setQuality(states[idx]);
    });

    document.getElementById('settings-bloom-btn')?.addEventListener('click', (e) => {
        const isOn = e.target.textContent === 'ON';
        e.target.textContent = isOn ? 'OFF' : 'ON';
        this.engine.setBloom(!isOn);
    });

    // Customization: Serpent Skin (Start Screen, In-Game HUD, Pause Screen, Settings)
    const openSkinBtn = document.getElementById('open-skin-btn');
    const hudSkinBtn = document.getElementById('hud-skin-btn');
    const pauseSkinBtn = document.getElementById('pause-skin-btn');
    const settingsSkinBtn = document.getElementById('settings-skin-btn');
    const closeSkinBtn = document.getElementById('close-skin-btn');

    const openSkinModal = (fromHUD = false) => {
      this._sourceScreen = this.gameState;
      if (this.gameState === 'PLAYING') {
        this.togglePause();
        this._openedFromPlaying = true;
      } else {
        this._openedFromPlaying = false;
      }
      if (this.cameraManager) this.cameraManager.setMode('custom_skin');
      this.populateSkinOptions();
      if (this._sourceScreen === 'START_SCREEN') {
        document.getElementById('start-screen')?.classList.add('hidden');
      }
      this.uiManager.showSkinScreen();

      // Launch 3D serpent live preview inside modal
      const preview = this.ensureSkinPreview();
      if (preview) {
        const currentSkinKey = this.snake ? this.snake.currentSkinId : (localStorage.getItem('vasuki_snake_skin') || 'emerald');
        const skinData = SNAKE_SKINS[currentSkinKey] || SNAKE_SKINS.emerald;
        preview.buildSerpent(skinData);
        preview.start();
        const lbl = document.getElementById('skin-preview-label');
        if (lbl) lbl.textContent = skinData.name;
      }
    };

    openSkinBtn?.addEventListener('click', () => openSkinModal(false));
    hudSkinBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSkinModal(true);
    });
    pauseSkinBtn?.addEventListener('click', () => {
      document.getElementById('pause-screen')?.classList.add('hidden');
      openSkinModal(false);
    });
    settingsSkinBtn?.addEventListener('click', () => {
      document.getElementById('settings-screen')?.classList.add('hidden');
      openSkinModal(false);
    });
    closeSkinBtn?.addEventListener('click', () => {
      if (this.skinPreview) {
        this.skinPreview.stop();
      }
      this.uiManager.hideSkinScreen();
      if (this.cameraManager) this.cameraManager.setMode('gameplay');
      if (this._openedFromPlaying) {
        this._openedFromPlaying = false;
        this.togglePause();
      } else if (this._sourceScreen === 'START_SCREEN') {
        document.getElementById('start-screen')?.classList.remove('hidden');
      } else if (this.gameState === 'PAUSED') {
        document.getElementById('pause-screen')?.classList.remove('hidden');
      }
    });

    // Customization: Realm Background (Start Screen, In-Game HUD, Pause Screen, Settings)
    const openRealmBtn = document.getElementById('open-realm-btn');
    const hudRealmBtn = document.getElementById('hud-realm-btn');
    const pauseRealmBtn = document.getElementById('pause-realm-btn');
    const settingsRealmBtn = document.getElementById('settings-realm-btn');
    const closeRealmBtn = document.getElementById('close-realm-btn');

    const openRealmModal = (fromHUD = false) => {
      this._sourceScreen = this.gameState;
      if (this.gameState === 'PLAYING') {
        this.togglePause();
        this._openedFromPlaying = true;
      } else {
        this._openedFromPlaying = false;
      }
      if (this.cameraManager) this.cameraManager.setMode('custom_realm');
      this.populateRealmOptions();
      if (this._sourceScreen === 'START_SCREEN') {
        document.getElementById('start-screen')?.classList.add('hidden');
      }
      this.uiManager.showRealmScreen();
    };

    openRealmBtn?.addEventListener('click', () => openRealmModal(false));
    hudRealmBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openRealmModal(true);
    });
    pauseRealmBtn?.addEventListener('click', () => {
      document.getElementById('pause-screen')?.classList.add('hidden');
      openRealmModal(false);
    });
    settingsRealmBtn?.addEventListener('click', () => {
      document.getElementById('settings-screen')?.classList.add('hidden');
      openRealmModal(false);
    });
    closeRealmBtn?.addEventListener('click', () => {
      this.uiManager.hideRealmScreen();
      if (this.cameraManager) this.cameraManager.setMode('gameplay');
      if (this._openedFromPlaying) {
        this._openedFromPlaying = false;
        this.togglePause();
      } else if (this._sourceScreen === 'START_SCREEN') {
        document.getElementById('start-screen')?.classList.remove('hidden');
      } else if (this.gameState === 'PAUSED') {
        document.getElementById('pause-screen')?.classList.remove('hidden');
      }
    });

    // Customization: Global Leaderboard
    const openLeaderboardBtn = document.getElementById('open-leaderboard-btn');
    const hudLeaderboardBtn = document.getElementById('hud-leaderboard-btn');
    const pauseLeaderboardBtn = document.getElementById('pause-leaderboard-btn');
    const gameoverLeaderboardBtn = document.getElementById('gameover-leaderboard-btn');
    const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
    const refreshLeaderboardBtn = document.getElementById('refresh-leaderboard-btn');
    const submitLeaderboardBtn = document.getElementById('leaderboard-submit-btn');

    const openLeaderboardModal = (fromHUD = false) => {
      this._sourceScreen = this.gameState;
      if (this.gameState === 'PLAYING') {
        this.togglePause();
        this._openedFromPlaying = true;
      } else {
        this._openedFromPlaying = false;
      }
      if (this.cameraManager) this.cameraManager.setMode('custom_realm');

      if (this._sourceScreen === 'START_SCREEN') {
        document.getElementById('start-screen')?.classList.add('hidden');
      } else if (this.gameState === 'GAME_OVER') {
        document.getElementById('game-over-screen')?.classList.add('hidden');
      }

      this.uiManager.showLeaderboardScreen();
      this.fetchAndDisplayLeaderboard();
    };

    openLeaderboardBtn?.addEventListener('click', () => openLeaderboardModal(false));
    hudLeaderboardBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLeaderboardModal(true);
    });
    pauseLeaderboardBtn?.addEventListener('click', () => {
      document.getElementById('pause-screen')?.classList.add('hidden');
      openLeaderboardModal(false);
    });
    gameoverLeaderboardBtn?.addEventListener('click', () => {
      document.getElementById('game-over-screen')?.classList.add('hidden');
      openLeaderboardModal(false);
    });

    closeLeaderboardBtn?.addEventListener('click', () => {
      this.uiManager.hideLeaderboardScreen();
      if (this.cameraManager) this.cameraManager.setMode('gameplay');
      if (this._openedFromPlaying) {
        this._openedFromPlaying = false;
        this.togglePause();
      } else if (this._sourceScreen === 'START_SCREEN') {
        document.getElementById('start-screen')?.classList.remove('hidden');
      } else if (this.gameState === 'PAUSED') {
        document.getElementById('pause-screen')?.classList.remove('hidden');
      } else if (this.gameState === 'GAME_OVER') {
        document.getElementById('game-over-screen')?.classList.remove('hidden');
      }
    });

    refreshLeaderboardBtn?.addEventListener('click', () => {
      this.fetchAndDisplayLeaderboard();
    });

    submitLeaderboardBtn?.addEventListener('click', async () => {
      const input = document.getElementById('leaderboard-player-name');
      const name = input ? input.value.trim() : '';
      if (!name) {
        this.uiManager.setSubmissionStatus('Please enter a name for the serpent', false);
        return;
      }

      submitLeaderboardBtn.disabled = true;
      submitLeaderboardBtn.textContent = 'ETCHING...';
      const result = await LeaderboardService.submitScore(name, this.score, {
        length: this.snake ? this.snake.getLengthMeters() + 'm' : '2m',
        apples: this.applesEaten || 0
      });

      this.uiManager.setSubmissionStatus(result.message, result.success);
    });

    const playerNameInput = document.getElementById('leaderboard-player-name');
    playerNameInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') {
        e.preventDefault();
        submitLeaderboardBtn?.click();
      }
    });
    playerNameInput?.addEventListener('keyup', (e) => e.stopPropagation());
    playerNameInput?.addEventListener('keypress', (e) => e.stopPropagation());
  }

  async fetchAndDisplayLeaderboard() {
    const statusEl = document.getElementById('leaderboard-status');
    if (statusEl) statusEl.textContent = 'Summoning ancient chronicle records...';
    try {
      const { scores, isOffline } = await LeaderboardService.getTopScores(10);
      this.uiManager.renderLeaderboard(scores, isOffline);
    } catch (err) {
      this.uiManager.renderLeaderboard(LeaderboardService.getLocalScores(), true);
    }
  }

  goToHome() {
    this.gameState = 'START_SCREEN';
    this.pausedForSettings = false;
    this.touchSteering = 0;
    this.touchBoosting = false;
    this.audioSystem.stopMusic();
    this.snake.reset();
    this.cameraManager.reset();
    this.uiManager.showStartScreen();
  }

  ensureSkinPreview() {
    if (!this.skinPreview) {
      const canvas = document.getElementById('skin-preview-canvas');
      if (canvas) {
        this.skinPreview = new SkinPreviewRenderer(canvas);
      }
    }
    return this.skinPreview;
  }

  populateSkinOptions() {
    const grid = document.getElementById('skin-options-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const currentSkin = this.snake ? this.snake.currentSkinId : (localStorage.getItem('vasuki_snake_skin') || 'emerald');

    for (const [key, skin] of Object.entries(SNAKE_SKINS)) {
      const card = document.createElement('div');
      card.className = `custom-card ${key === currentSkin ? 'active' : ''}`;
      card.innerHTML = `
        <div class="skin-swatch-box">
          <div class="swatch-half" style="background: ${skin.swatchPrimary};"></div>
          <div class="swatch-half" style="background: ${skin.swatchSecondary};"></div>
        </div>
        <div class="custom-card-title">${skin.name}</div>
        <div class="custom-card-desc">${skin.desc}</div>
      `;
      card.addEventListener('click', () => {
        if (this.snake) {
          this.snake.setSkin(key);
        }
        if (this.skinPreview) {
          this.skinPreview.buildSerpent(skin);
        }
        const lbl = document.getElementById('skin-preview-label');
        if (lbl) {
          lbl.textContent = skin.name;
        }
        grid.querySelectorAll('.custom-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
      grid.appendChild(card);
    }
  }

  populateRealmOptions() {
    const grid = document.getElementById('realm-options-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const currentRealm = (this.engine && this.engine.dayNightCycle) 
      ? this.engine.dayNightCycle.currentRealmId 
      : (localStorage.getItem('vasuki_background_realm') || 'cycle');

    for (const [key, realm] of Object.entries(REALM_PRESETS)) {
      const card = document.createElement('div');
      card.className = `custom-card ${key === currentRealm ? 'active' : ''}`;
      card.innerHTML = `
        <div class="custom-card-icon">${realm.icon}</div>
        <div class="custom-card-title">${realm.name}</div>
        <div class="custom-card-desc">${realm.desc}</div>
      `;
      card.addEventListener('click', () => {
        if (this.engine) {
          this.engine.setRealm(key);
        }
        grid.querySelectorAll('.custom-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
      grid.appendChild(card);
    }
  }

  sectorTarget(sector) {
    return Math.min(18, 6 + sector * 2);
  }

  appleStock(sector) {
    return Math.min(8, 4 + Math.floor(sector / 2));
  }

  startGame() {
    this.score = 0;
    this.sector = 1;
    this.coresCollected = 0;
    this.sectorCoreTarget = this.sectorTarget(1);
    this.nitroEnergy = 100;
    this.jumpEnergy = 100;
    this.overclockTimer = 0;
    this.scoreMultiplier = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.applesEaten = 0;
    this.isBoosting = false;

    this.snake.reset();
    this.cameraManager.reset();
    this.obstacles.setupSectorObstacles(this.sector);
    this.foodManager.spawnInitial(this.appleStock(this.sector));

    this.touchSteering = 0;
    this.touchBoosting = false;
    this.pausedForSettings = false;
    this.resumeGrace = true;
    this.gameState = 'PLAYING';
    this.uiManager.showGameHUD();
    this.audioSystem.startMusic();
  }

  restartGame() {
    this.startGame();
  }

  togglePause() {
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.pausedForSettings = false;
      this.touchSteering = 0;
      this.touchBoosting = false;
      this.uiManager.showPauseScreen();
      this.audioSystem.stopMusic();
    } else if (this.gameState === 'PAUSED') {
      document.getElementById('settings-screen')?.classList.add('hidden');
      this.gameState = 'PLAYING';
      this.pausedForSettings = false;
      this.resumeGrace = true;
      this.uiManager.hidePauseScreen();
      this.audioSystem.startMusic();
    }
  }

  openSettings() {
    document.getElementById('settings-screen').classList.remove('hidden');
    this.uiManager.setTouchVisible(false);
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.pausedForSettings = true;
      this.touchSteering = 0;
      this.touchBoosting = false;
      this.audioSystem.stopMusic();
    }
  }

  closeSettings() {
    document.getElementById('settings-screen').classList.add('hidden');
    if (this.pausedForSettings && this.gameState === 'PAUSED') {
      this.pausedForSettings = false;
      this.gameState = 'PLAYING';
      this.resumeGrace = true;
      this.audioSystem.startMusic();
      this.uiManager.setTouchVisible(true);
    }
  }

  tryJump() {
    if (this.jumpEnergy >= 100 && !this.snake.isJumping) {
      if (this.snake.jump()) {
        this.jumpEnergy = 0;
        this.audioSystem.playJump();
        this.cameraManager.triggerShake(0.3);
      }
    }
  }

  getSteeringInput() {
    // Keyboard steering — ALWAYS compute fresh
    // Pressing A / Left Arrow turns LEFT (+1.0 in local coordinate space)
    // Pressing D / Right Arrow turns RIGHT (-1.0 in local coordinate space)
    let steer = 0;
    if (this.keysPressed['KeyA'] || this.keysPressed['ArrowLeft']) steer += 1.0;
    if (this.keysPressed['KeyD'] || this.keysPressed['ArrowRight']) steer -= 1.0;

    // Blend with touch steering
    if (this.touchSteering !== 0) {
      steer = -this.touchSteering;
    }

    return steer;
  }

  getBoostInput() {
    return (
      this.keysPressed['KeyW'] ||
      this.keysPressed['ArrowUp'] ||
      this.keysPressed['ShiftLeft'] ||
      this.keysPressed['ShiftRight'] ||
      this.touchBoosting
    ) && (this.nitroEnergy > 0);
  }

  gameLoop(now) {
    try {
      let delta = (now - this.lastTime) / 1000;
      this.lastTime = now;

      if (this.resumeGrace || !Number.isFinite(delta) || delta < 0 || delta > 0.1) {
        this.resumeGrace = false;
        delta = 1 / 60;
      }
      delta = Math.min(0.05, Math.max(0, delta));

      if (this.gameState === 'PLAYING') {
        this.updateGameLogic(now / 1000, delta);
      } else {
        if (this.cameraManager) {
          this.cameraManager.updatePreview(this.snake?.headPos, this.snake?.yaw, delta);
        }
        if (this.snake && (this.gameState === 'START_SCREEN' || this._sourceScreen === 'START_SCREEN')) {
          this.snake.updateIdle(now / 1000);
        }
        this.engine.update(now / 1000, delta, false);
        this.engine.render();
        requestAnimationFrame((t) => this.gameLoop(t));
        return;
      }

      this.engine.update(now / 1000, delta, this.isBoosting);
      this.engine.render();
    } catch (err) {
      console.error('Game loop error:', err);
    }

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  updateGameLogic(time, delta) {
    const steering = this.getSteeringInput();
    this.isBoosting = this.getBoostInput();

    this.snake.applyProgression(this.sector, this.snake.segments.length);
    this.snake.speedMul = this.overclockTimer > 0 ? 1.12 : 1;

    const nitroDrain = 28 + this.sector * 1.5;
    const nitroRegen = Math.max(10, 18 - this.sector * 0.6);
    if (this.isBoosting) {
      this.nitroEnergy = Math.max(0, this.nitroEnergy - delta * nitroDrain);
    } else {
      this.nitroEnergy = Math.min(this.maxNitro, this.nitroEnergy + delta * nitroRegen);
    }

    if (this.jumpEnergy < 100) {
      this.jumpEnergy = Math.min(100, this.jumpEnergy + delta * this.jumpCooldownSpeed);
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    const activeBuffs = [];
    if (this.overclockTimer > 0) {
      this.overclockTimer -= delta;
      this.scoreMultiplier = 2;
      activeBuffs.push(`2X ${Math.ceil(this.overclockTimer)}s`);
      if (this.overclockTimer <= 0) this.scoreMultiplier = 1;
    }
    if (this.snake.hasShield) {
      activeBuffs.push(`SHIELD ${Math.ceil(this.snake.shieldTimer)}s`);
    }
    if (this.combo >= 2) {
      activeBuffs.push(`COMBO x${this.combo}`);
    }
    if (this.snake.invulnTimer > 0 && !this.snake.hasShield) {
      activeBuffs.push('SAFE');
    }

    this.snake.update(steering, this.isBoosting, delta);
    if (this.snake.justLanded) this.cameraManager.triggerShake(0.22);

    this.cameraManager.update(
      this.snake.headPos,
      this.snake.yaw,
      this.snake.yOffset,
      this.isBoosting,
      this.snake.turnDelta,
      delta
    );

    this.foodManager.update(time, delta);
    const pickupType = this.foodManager.checkPickups(this.snake.headPos, this.snake.yOffset);
    if (pickupType) this.handlePickup(pickupType);

    this.obstacles.update(time, delta);
    const hitObstacle = this.obstacles.checkCollisions(this.snake.headPos, this.snake.yOffset);
    const hitSelf = this.snake.checkSelfCollision();
    const hitBoundary = this.snake.checkBoundaryCollision();

    if (hitObstacle || hitSelf || hitBoundary) {
      if (!this.trySurviveHit()) {
        this.handleGameOver();
        return;
      }
    }

    const objective = this.gameMode === 'CAMPAIGN'
      ? `APPLES ${this.coresCollected}/${this.sectorCoreTarget}`
      : `WAVE ${this.sector}  •  ${this.applesEaten} APPLES`;

    this.uiManager.updateHUD(
      this.score,
      this.highScore,
      this.sector,
      this.snake.getLengthMeters(),
      this.nitroEnergy,
      this.jumpEnergy,
      activeBuffs,
      objective
    );
  }

  trySurviveHit() {
    if (this.snake.isInvulnerable) return true;
    if (this.snake.consumeShield()) {
      this.cameraManager.triggerShake(0.45);
      this.audioSystem.playEmp();
      return true;
    }
    return false;
  }

  advanceSector() {
    this.sector++;
    this.coresCollected = 0;
    this.sectorCoreTarget = this.sectorTarget(this.sector);
    this.score += 40 * this.sector * this.scoreMultiplier;
    this.snake.invulnTimer = Math.max(this.snake.invulnTimer, 1.4);
    this.snake.isInvulnerable = true;
    this.obstacles.setupSectorObstacles(this.sector);
    this.foodManager.ensureAppleCount(this.appleStock(this.sector));
    this.cameraManager.triggerShake(0.4);
    this.audioSystem.playLevelUp();
  }

  handlePickup(type) {
    if (type === 'core') {
      if (this.comboTimer > 0) this.combo += 1;
      else this.combo = 1;
      this.comboTimer = 3.6;
      const comboBonus = 1 + Math.max(0, this.combo - 1) * 0.25;
      this.score += Math.round(10 * this.scoreMultiplier * comboBonus);
      this.coresCollected++;
      this.applesEaten++;
      this.snake.addSegment();
      this.audioSystem.playEat(this.combo);
      if (this.combo >= 2) {
        this.cameraManager.punch(4 + Math.min(8, this.combo));
        this.cameraManager.triggerShake(0.08 + Math.min(0.2, this.combo * 0.03));
      }
      this.foodManager.spawnItem('core');
      this.foodManager.ensureAppleCount(this.appleStock(this.sector));

      if (Math.random() < 0.22) this.foodManager.spawnRandomPowerUp();

      if (this.gameMode === 'CAMPAIGN' && this.coresCollected >= this.sectorCoreTarget) {
        this.advanceSector();
      } else if (this.gameMode === 'ENDLESS' && this.applesEaten % 12 === 0) {
        this.advanceSector();
      }
    } else if (type === 'overclock') {
      this.score += 25 * this.scoreMultiplier;
      this.overclockTimer = 8.0;
      this.cameraManager.punch(10);
      this.cameraManager.triggerShake(0.25);
      this.audioSystem.playOverclock();
    } else if (type === 'emp') {
      this.score += 15 * this.scoreMultiplier;
      this.snake.removeSegments(2);
      this.snake.invulnTimer = Math.max(this.snake.invulnTimer, 1.0);
      this.snake.isInvulnerable = true;
      this.audioSystem.playEmp();
      this.cameraManager.triggerShake(0.35);
    } else if (type === 'shield') {
      this.score += 20 * this.scoreMultiplier;
      this.snake.grantShield(10);
      this.audioSystem.playShield();
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('vasuki_indicus_highscore', String(this.highScore));
    }
  }

  handleGameOver() {
    this.gameState = 'GAME_OVER';
    this.audioSystem.playExplosion();
    this.audioSystem.stopMusic();
    this.cameraManager.triggerShake(0.6);

    this.uiManager.showGameOverScreen(
      this.score,
      this.highScore,
      this.applesEaten,
      this.snake.getLengthMeters()
    );

    // Initialize leaderboard score submission form with previous serpent name
    const savedName = LeaderboardService.getSavedPlayerName();
    this.uiManager.resetSubmissionForm(savedName);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
});
