export class UIManager {
  constructor() {
    this.hudLayer = document.getElementById('hud-layer');
    this.startScreen = document.getElementById('start-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.touchControls = document.getElementById('touch-controls');
    this.skinScreen = document.getElementById('skin-screen');
    this.realmScreen = document.getElementById('realm-screen');
    this.leaderboardScreen = document.getElementById('leaderboard-screen');

    this.scoreEl = document.getElementById('score-display');
    this.highScoreEl = document.getElementById('high-score-display');
    this.sectorEl = document.getElementById('sector-display');
    this.lengthEl = document.getElementById('length-display');

    this.nitroBar = document.getElementById('nitro-bar');
    this.nitroVal = document.getElementById('nitro-val');

    this.jumpBar = document.getElementById('jump-bar');
    this.jumpVal = document.getElementById('jump-val');

    this.buffContainer = document.getElementById('buff-container');
    this.objectiveBanner = document.getElementById('objective-banner');
  }

  setTouchVisible(visible) {
    if (!this.touchControls || !document.body.classList.contains('touch-ui')) return;
    this.touchControls.classList.toggle('hidden', !visible);
  }

  updateHUD(score, highScore, sector, lengthMeters, nitroPct, jumpPct, activeBuffs, objectiveText) {
    this.scoreEl.textContent = String(score).padStart(4, '0');
    this.highScoreEl.textContent = String(highScore).padStart(4, '0');
    this.sectorEl.textContent = String(sector).padStart(2, '0');
    this.lengthEl.textContent = `${lengthMeters}m`;

    if (this.objectiveBanner && objectiveText) {
      this.objectiveBanner.textContent = objectiveText;
    }

    const nitroRounded = Math.floor(nitroPct);
    this.nitroBar.style.width = `${nitroRounded}%`;
    this.nitroVal.textContent = `${nitroRounded}%`;

    const jumpRounded = Math.floor(jumpPct);
    this.jumpBar.style.width = `${jumpRounded}%`;
    this.jumpVal.textContent = jumpRounded >= 100 ? 'READY' : `${jumpRounded}%`;

    this.buffContainer.innerHTML = '';
    for (const buff of activeBuffs) {
      const badge = document.createElement('div');
      badge.className = 'buff-badge';
      badge.textContent = buff;
      this.buffContainer.appendChild(badge);
    }
  }

  showStartScreen() {
    this.startScreen.classList.remove('hidden');
    this.hudLayer.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    if (this.skinScreen) this.skinScreen.classList.add('hidden');
    if (this.realmScreen) this.realmScreen.classList.add('hidden');
    this.setTouchVisible(false);
  }

  showSkinScreen() {
    if (this.skinScreen) this.skinScreen.classList.remove('hidden');
  }

  hideSkinScreen() {
    if (this.skinScreen) this.skinScreen.classList.add('hidden');
  }

  showRealmScreen() {
    if (this.realmScreen) this.realmScreen.classList.remove('hidden');
  }

  hideRealmScreen() {
    if (this.realmScreen) this.realmScreen.classList.add('hidden');
  }

  showGameHUD() {
    this.startScreen.classList.add('hidden');
    this.hudLayer.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.setTouchVisible(true);
  }

  showPauseScreen() {
    this.pauseScreen.classList.remove('hidden');
    this.setTouchVisible(false);
  }

  hidePauseScreen() {
    this.pauseScreen.classList.add('hidden');
    this.setTouchVisible(true);
  }

  showGameOverScreen(finalScore, highScore, cores, maxLength) {
    document.getElementById('final-score').textContent = finalScore;
    document.getElementById('final-high-score').textContent = highScore;
    document.getElementById('final-cores').textContent = cores;
    document.getElementById('final-length').textContent = `${maxLength}m`;

    if (this.skinScreen) this.skinScreen.classList.add('hidden');
    if (this.realmScreen) this.realmScreen.classList.add('hidden');
    if (this.leaderboardScreen) this.leaderboardScreen.classList.add('hidden');

    this.gameOverScreen.classList.remove('hidden');
    this.setTouchVisible(false);
  }

  showLeaderboardScreen() {
    if (this.leaderboardScreen) this.leaderboardScreen.classList.remove('hidden');
  }

  hideLeaderboardScreen() {
    if (this.leaderboardScreen) this.leaderboardScreen.classList.add('hidden');
  }

  renderLeaderboard(scores = [], isOffline = false) {
    const tbody = document.getElementById('leaderboard-table-body');
    const statusEl = document.getElementById('leaderboard-status');
    if (statusEl) {
      statusEl.textContent = isOffline 
        ? '📜 Sacred Scrolls (Local & Offline Chronicles)' 
        : '⚡ Synchronized with AWS Cloud Leaderboard';
    }

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!scores || scores.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="5" style="text-align: center; padding: 18px; color: var(--text-muted);">No ancient records found. Inscribe your first score!</td>`;
      tbody.appendChild(row);
      return;
    }

    scores.forEach((item, index) => {
      const rank = item.rank || (index + 1);
      const row = document.createElement('tr');

      let badgeClass = 'rank-norm';
      if (rank === 1) badgeClass = 'rank-1';
      else if (rank === 2) badgeClass = 'rank-2';
      else if (rank === 3) badgeClass = 'rank-3';

      row.innerHTML = `
        <td style="text-align: center;"><span class="rank-badge ${badgeClass}">${rank}</span></td>
        <td style="font-weight: 600; color: ${rank === 1 ? 'var(--gold-light)' : 'var(--text-color)'};">${escapeHtml(item.playerName || 'Ancient Serpent')}</td>
        <td style="text-align: right; font-weight: bold; color: var(--gold);">${(item.score || 0).toLocaleString()}</td>
        <td style="text-align: right; color: var(--text-muted);">${item.length || '2m'}</td>
        <td style="text-align: right; color: var(--text-muted); font-size: 10px;">${item.date || 'Recorded'}</td>
      `;
      tbody.appendChild(row);
    });
  }

  resetSubmissionForm(savedPlayerName = '') {
    const input = document.getElementById('leaderboard-player-name');
    const btn = document.getElementById('leaderboard-submit-btn');
    const msg = document.getElementById('leaderboard-submit-msg');
    if (input) {
      input.value = savedPlayerName || '';
      input.disabled = false;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'SUBMIT';
    }
    if (msg) {
      msg.textContent = '';
      msg.style.color = 'var(--gold-light)';
    }
  }

  setSubmissionStatus(text, isSuccess = true) {
    const msg = document.getElementById('leaderboard-submit-msg');
    const btn = document.getElementById('leaderboard-submit-btn');
    const input = document.getElementById('leaderboard-player-name');
    if (msg) {
      msg.textContent = text;
      msg.style.color = isSuccess ? 'var(--gold)' : '#e06050';
    }
    if (isSuccess && btn) {
      btn.textContent = 'INSCRIBED';
      btn.disabled = true;
    }
    if (isSuccess && input) {
      input.disabled = true;
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

