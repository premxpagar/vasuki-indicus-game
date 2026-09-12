/**
 * VASUKI INDICUS — Rise of the Ancient Serpent
 * Leaderboard Service
 * 
 * Secure, isolated API client for AWS API Gateway -> Lambda -> DynamoDB.
 * Features:
 * - Zero AWS credentials in client-side code.
 * - Non-blocking asynchronous network calls.
 * - Automatic offline fallback with local storage persistence.
 * - Input sanitization and validation.
 */

import { CONFIG } from './config.js';

export class LeaderboardService {
  /**
   * Get the saved player name, or default
   */
  static getSavedPlayerName() {
    try {
      return localStorage.getItem(CONFIG.STORAGE_KEY_PLAYER_NAME) || '';
    } catch {
      return '';
    }
  }

  /**
   * Save the player name for future sessions
   */
  static savePlayerName(name) {
    try {
      const sanitized = (name || '').trim().slice(0, 16);
      if (sanitized) {
        localStorage.setItem(CONFIG.STORAGE_KEY_PLAYER_NAME, sanitized);
      }
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Retrieve local leaderboard storage
   */
  static getLocalScores() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY_LOCAL_LEADERBOARD);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return [...CONFIG.DEFAULT_LEADERBOARD];
  }

  /**
   * Store local leaderboard
   */
  static saveLocalScore(entry) {
    try {
      const list = this.getLocalScores();
      list.push(entry);
      list.sort((a, b) => (b.score || 0) - (a.score || 0));
      const top10 = list.slice(0, 10).map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
      localStorage.setItem(CONFIG.STORAGE_KEY_LOCAL_LEADERBOARD, JSON.stringify(top10));
      return top10;
    } catch {
      return CONFIG.DEFAULT_LEADERBOARD;
    }
  }

  /**
   * Fetch top scores from AWS API Gateway or fallback
   * @param {number} limit 
   * @returns {Promise<{scores: Array, isOffline: boolean}>}
   */
  static async getTopScores(limit = 10) {
    const baseUrl = (CONFIG.API_GATEWAY_URL || '').trim().replace(/\/+$/, '');

    // If AWS API Gateway URL is configured, attempt remote fetch
    if (baseUrl) {
      try {
        const endpoint = `${baseUrl}${CONFIG.LEADERBOARD_ENDPOINT}?limit=${limit}`;
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.scores || data.items || []);
          if (Array.isArray(items) && items.length > 0) {
            const formatted = items.map((it, idx) => ({
              rank: idx + 1,
              playerName: it.playerName || it.name || 'Ancient Serpent',
              score: parseInt(it.score, 10) || 0,
              length: it.length || `${it.apples || 0}m`,
              date: it.date ? new Date(it.date).toLocaleDateString() : 'Recorded'
            }));
            return { scores: formatted, isOffline: false };
          }
        }
      } catch (err) {
        console.warn('LeaderboardService: Remote AWS fetch failed, using local chronicle cache:', err.message);
      }
    }

    // Fallback to local stored scores
    const local = this.getLocalScores();
    return { scores: local.slice(0, limit), isOffline: !baseUrl };
  }

  /**
   * Submit a player's score to AWS API Gateway and local cache
   * @param {string} playerName 
   * @param {number} score 
   * @param {object} stats { length, apples }
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async submitScore(playerName, score, stats = {}) {
    const cleanName = (playerName || '').trim().slice(0, 16) || 'Ancient Serpent';
    const numericScore = Math.max(0, parseInt(score, 10) || 0);
    this.savePlayerName(cleanName);

    const payload = {
      playerName: cleanName,
      score: numericScore,
      length: stats.length || '2m',
      apples: stats.apples || 0,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };

    // Always update local cache so user immediately sees their accomplishment
    this.saveLocalScore({
      playerName: cleanName,
      score: numericScore,
      length: payload.length,
      date: 'Today'
    });

    const baseUrl = (CONFIG.API_GATEWAY_URL || '').trim().replace(/\/+$/, '');

    // If AWS API Gateway URL is configured, POST to backend
    if (baseUrl) {
      try {
        const endpoint = `${baseUrl}${CONFIG.LEADERBOARD_ENDPOINT}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          return { success: true, message: 'Your score has been inscribed in the Sacred Cloud Chronicles!' };
        } else {
          return { success: true, message: 'Saved locally. (Cloud sync returned status ' + res.status + ')' };
        }
      } catch (err) {
        return { success: true, message: 'Saved to local chronicles (Cloud currently unreachable).' };
      }
    }

    return { success: true, message: 'Score etched into local sacred scrolls!' };
  }
}
