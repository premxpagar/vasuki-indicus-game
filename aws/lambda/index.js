/**
 * VASUKI INDICUS — Rise of the Ancient Serpent
 * AWS Lambda Leaderboard Handler (Node.js 20.x)
 * 
 * Handles:
 * - OPTIONS /leaderboard (CORS preflight)
 * - GET /leaderboard?limit=10 (Fetch top scores from DynamoDB)
 * - POST /leaderboard (Submit new player score to DynamoDB)
 * 
 * Security: Uses IAM execution role with minimal DynamoDB access permissions.
 * No hardcoded AWS credentials.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'VasukiLeaderboard';
const GAME_ID = 'VASUKI_INDICUS';

// Standard CORS response headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.requestContext?.http?.path || event.path || '/leaderboard';

  // 1. Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  try {
    // 2. Handle GET /leaderboard
    if (method === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '10', 10);
      const safeLimit = Math.min(Math.max(1, limit), 50);

      // Query by gameId ordered by score descending
      try {
        const queryParams = {
          TableName: TABLE_NAME,
          KeyConditionExpression: 'gameId = :gid',
          ExpressionAttributeValues: {
            ':gid': GAME_ID
          },
          ScanIndexForward: false, // Descending order (highest score first)
          Limit: safeLimit
        };

        const result = await docClient.send(new QueryCommand(queryParams));
        const scores = (result.Items || []).map((item, idx) => ({
          rank: idx + 1,
          playerName: item.playerName || 'Ancient Serpent',
          score: item.score,
          length: item.length || '2m',
          apples: item.apples || 0,
          date: item.date || item.timestamp
        }));

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ scores })
        };
      } catch (queryErr) {
        // Fallback: If table is keyed differently, perform a safe scan & sort
        const scanResult = await docClient.send(new ScanCommand({
          TableName: TABLE_NAME,
          Limit: 100
        }));

        const sorted = (scanResult.Items || [])
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, safeLimit)
          .map((item, idx) => ({
            rank: idx + 1,
            playerName: item.playerName || 'Ancient Serpent',
            score: item.score,
            length: item.length || '2m',
            apples: item.apples || 0,
            date: item.date || item.timestamp
          }));

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ scores: sorted })
        };
      }
    }

    // 3. Handle POST /leaderboard
    if (method === 'POST') {
      let body;
      try {
        let raw = event.body;
        if (event.isBase64Encoded && typeof raw === 'string') {
          raw = Buffer.from(raw, 'base64').toString('utf8');
        }
        body = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (e) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid JSON payload' })
        };
      }

      const playerName = (body.playerName || '').toString().trim().slice(0, 16) || 'Ancient Serpent';
      const score = Math.max(0, parseInt(body.score, 10) || 0);
      const length = (body.length || '2m').toString().slice(0, 10);
      const apples = Math.max(0, parseInt(body.apples, 10) || 0);

      const entryId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const timestamp = Date.now();
      const dateStr = new Date().toISOString();

      const item = {
        gameId: GAME_ID,
        score: score,
        id: entryId,
        playerName: playerName,
        length: length,
        apples: apples,
        timestamp: timestamp,
        date: dateStr
      };

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }));

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          message: 'Score successfully recorded in ancient scrolls',
          entry: {
            playerName,
            score,
            length,
            date: dateStr
          }
        })
      };
    }

    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Endpoint not found' })
    };
  } catch (error) {
    console.error('Leaderboard Lambda error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal server error processing chronicle score',
        details: error.message
      })
    };
  }
};
