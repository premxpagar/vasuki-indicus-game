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

    // Multiplayer UI elements
    this.mpScreen = document.getElementById('multiplayer-screen');
    this.mpGameOverScreen = document.getElementById('mp-game-over-screen');
    this.mpHudPanel = document.getElementById('mp-hud-panel');
    this.mpP1Score = document.getElementById('mp-p1-score');
    this.mpP1Lives = document.getElementById('mp-p1-lives');
    this.mpP2Score = document.getElementById('mp-p2-score');
    this.mpP2Lives = document.getElementById('mp-p2-lives');
    this.mpP1Name = document.getElementById('mp-p1-name');
    this.mpP2Name = document.getElementById('mp-p2-name');
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
    if (this.mpScreen) this.mpScreen.classList.add('hidden');
    if (this.mpGameOverScreen) this.mpGameOverScreen.classList.add('hidden');
    if (this.mpHudPanel) this.mpHudPanel.classList.add('hidden');
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

  showMultiplayerScreen() {
    if (this.mpScreen) this.mpScreen.classList.remove('hidden');
    this.setTouchVisible(false);
  }

  hideMultiplayerScreen() {
    if (this.mpScreen) this.mpScreen.classList.add('hidden');
  }

  setupMultiplayerHUD(p1Name, p2Name) {
    if (this.mpP1Name) this.mpP1Name.textContent = p1Name || 'YOU';
    if (this.mpP2Name) this.mpP2Name.textContent = p2Name || 'OPPONENT';
    this.updateMultiplayerHUD(0, 0, 3, 3);
    if (this.mpHudPanel) this.mpHudPanel.classList.remove('hidden');
  }

  updateMultiplayerHUD(p1Score = 0, p2Score = 0, p1Lives = 3, p2Lives = 3) {
    if (this.mpP1Score) this.mpP1Score.textContent = p1Score;
    if (this.mpP2Score) this.mpP2Score.textContent = p2Score;

    const renderHearts = (lives) => {
      let hearts = '';
      for (let i = 0; i < 3; i++) {
        hearts += i < lives ? '❤️' : '🖤';
      }
      return hearts;
    };

    if (this.mpP1Lives) this.mpP1Lives.textContent = renderHearts(p1Lives);
    if (this.mpP2Lives) this.mpP2Lives.textContent = renderHearts(p2Lives);
  }

  showMultiplayerGameOver(winnerSlot, winnerName, reason, p1, p2, mySlot) {
    const isWinner = winnerSlot === mySlot;
    const isDraw = winnerSlot === 'draw';

    const titleEl = document.getElementById('mp-result-title');
    const badgeEl = document.getElementById('mp-result-badge');
    const reasonEl = document.getElementById('mp-result-reason');

    if (titleEl) {
      if (isDraw) {
        titleEl.textContent = 'SACRED DRAW!';
        titleEl.style.color = 'var(--gold-light)';
      } else if (isWinner) {
        titleEl.textContent = 'VICTORY!';
        titleEl.style.color = '#7ad480';
      } else {
        titleEl.textContent = 'DEFEAT!';
        titleEl.style.color = '#a63d2f';
      }
    }

    if (badgeEl) {
      badgeEl.textContent = isDraw
        ? '◆ EQUAL VALOR ◆'
        : (isWinner ? '◆ SUPREME SERPENT ◆' : '◆ THE SERPENT FALLS ◆');
    }

    if (reasonEl) {
      reasonEl.textContent = reason || (isWinner ? `${winnerName} claims victory!` : 'Better fortune in the next contest.');
    }

    const sumP1Name = document.getElementById('mp-sum-p1-name');
    const sumP1Score = document.getElementById('mp-sum-p1-score');
    const sumP1Lives = document.getElementById('mp-sum-p1-lives');

    const sumP2Name = document.getElementById('mp-sum-p2-name');
    const sumP2Score = document.getElementById('mp-sum-p2-score');
    const sumP2Lives = document.getElementById('mp-sum-p2-lives');

    const renderHearts = (lives) => {
      let hearts = '';
      for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️' : '🖤';
      return hearts;
    };

    if (sumP1Name) sumP1Name.textContent = p1.name || 'PLAYER 1';
    if (sumP1Score) sumP1Score.textContent = p1.score || 0;
    if (sumP1Lives) sumP1Lives.textContent = renderHearts(p1.lives);

    if (sumP2Name) sumP2Name.textContent = p2.name || 'PLAYER 2';
    if (sumP2Score) sumP2Score.textContent = p2.score || 0;
    if (sumP2Lives) sumP2Lives.textContent = renderHearts(p2.lives);

    const rematchStatus = document.getElementById('mp-rematch-status');
    if (rematchStatus) rematchStatus.textContent = '';

    const rematchBtn = document.getElementById('mp-rematch-btn');
    if (rematchBtn) {
      rematchBtn.disabled = false;
      rematchBtn.textContent = '⚔️ REMATCH';
    }

    if (this.mpGameOverScreen) this.mpGameOverScreen.classList.remove('hidden');
    this.setTouchVisible(false);
  }

  hideMultiplayerGameOver() {
    if (this.mpGameOverScreen) this.mpGameOverScreen.classList.add('hidden');
  }

  showGameHUD(isMultiplayer = false) {
    this.startScreen.classList.add('hidden');
    this.hudLayer.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    if (this.mpScreen) this.mpScreen.classList.add('hidden');
    if (this.mpGameOverScreen) this.mpGameOverScreen.classList.add('hidden');

    if (this.mpHudPanel) {
      this.mpHudPanel.classList.toggle('hidden', !isMultiplayer);
    }
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
    if (this.mpScreen) this.mpScreen.classList.add('hidden');
    if (this.mpGameOverScreen) this.mpGameOverScreen.classList.add('hidden');

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

