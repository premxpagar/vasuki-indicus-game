/**
 * VASUKI INDICUS — Rise of the Ancient Serpent
 * Configuration Module
 * 
 * Secure configuration for AWS API Gateway integration and offline fallback.
 * NOTE: Never place AWS Access Keys or IAM secrets in client-side files.
 */

export const CONFIG = {
  // Production AWS API Gateway HTTP API endpoint
  API_GATEWAY_URL: 'https://5si18uxg7i.execute-api.eu-north-1.amazonaws.com',

  // Endpoints
  LEADERBOARD_ENDPOINT: '/leaderboard',

  // Local storage keys for caching and offline fallback
  STORAGE_KEY_PLAYER_NAME: 'vasuki_player_name',
  STORAGE_KEY_LOCAL_LEADERBOARD: 'vasuki_local_leaderboard',

  // Initial ancient chronicle records displayed when offline or before remote scores are logged
  DEFAULT_LEADERBOARD: [
    { rank: 1, playerName: 'Vasuki Prime', score: 1250, length: '32m', date: 'Ancient Era' },
    { rank: 2, playerName: 'Naga Raja', score: 980, length: '26m', date: 'Vedic Epoch' },
    { rank: 3, playerName: 'Kaliya', score: 840, length: '22m', date: 'Vedic Epoch' },
    { rank: 4, playerName: 'Shesha Serpent', score: 720, length: '19m', date: 'Satya Yuga' },
    { rank: 5, playerName: 'Takshaka', score: 610, length: '16m', date: 'Satya Yuga' },
    { rank: 6, playerName: 'Mahapadma', score: 530, length: '14m', date: 'Treta Yuga' },
    { rank: 7, playerName: 'Kulika', score: 450, length: '12m', date: 'Treta Yuga' },
    { rank: 8, playerName: 'Shankhapala', score: 390, length: '10m', date: 'Dvapara Yuga' },
    { rank: 9, playerName: 'Elapatra', score: 310, length: '8m', date: 'Dvapara Yuga' },
    { rank: 10, playerName: 'Padma Serpent', score: 260, length: '7m', date: 'Kali Yuga' }
  ]
};
