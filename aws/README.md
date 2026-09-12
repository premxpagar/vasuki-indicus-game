# VASUKI INDICUS — AWS Serverless Leaderboard Backend

This directory contains the production-ready AWS Serverless Backend for **VASUKI INDICUS: Rise of the Ancient Serpent**.

## Architecture Overview

```
Browser Game (Client)
        ↓  HTTPS JSON (fetch)
Amazon API Gateway (HTTP API v2 with CORS)
        ↓  Payload Proxy
AWS Lambda (Node.js 20.x Handler)
        ↓  IAM Least-Privilege Role
Amazon DynamoDB (VasukiLeaderboard Table)
```

### Security Highlights
* **Zero IAM / AWS Secret Exposure**: Client-side code contains **no AWS access keys, secret keys, or IAM credentials**.
* **CORS Configured**: Allows safe browser queries from any hosted origin.
* **Pay-per-request / Free-tier friendly**: Uses DynamoDB On-Demand billing and serverless execution.

---

## Deployment Instructions

### Option 1: Fast Deployment with AWS SAM CLI (Recommended)

1. Open a terminal in the `aws/` directory:
   ```bash
   cd aws
   ```
2. Build and deploy the stack:
   ```bash
   sam build
   sam deploy --guided
   ```
3. Follow the guided prompts:
   * **Stack Name**: `vasuki-indicus-leaderboard`
   * **AWS Region**: your preferred region (e.g. `us-east-1`, `ap-south-1`)
   * **Allow SAM CLI to create IAM roles**: `y`
   * **Confirm changes before deploy**: `y`
4. When deployment completes, SAM outputs the **`LeaderboardApiEndpoint`**:
   ```
   Outputs:
   LeaderboardApiEndpoint = https://abcdef1234.execute-api.us-east-1.amazonaws.com
   ```
5. Open `js/config.js` in the project root and paste your endpoint URL:
   ```javascript
   export const CONFIG = {
     API_GATEWAY_URL: 'https://abcdef1234.execute-api.us-east-1.amazonaws.com',
     ...
   };
   ```

---

### Option 2: Manual Setup via AWS Console

If you prefer using the AWS Management Console:
1. **DynamoDB**:
   * Create Table named `VasukiLeaderboard`.
   * Partition Key: `gameId` (String).
   * Sort Key: `score` (Number).
2. **Lambda**:
   * Create a Function named `VasukiLeaderboardHandler` with **Node.js 20.x**.
   * Paste the code from `aws/lambda/index.js`.
   * Under Configuration > Permissions, attach a policy allowing `dynamodb:PutItem`, `dynamodb:Query`, `dynamodb:Scan` on `VasukiLeaderboard`.
   * Under Configuration > Environment variables, set `TABLE_NAME = VasukiLeaderboard`.
3. **API Gateway**:
   * Create an **HTTP API**.
   * Add routes:
     * `GET /leaderboard` -> Integrate with Lambda `VasukiLeaderboardHandler`.
     * `POST /leaderboard` -> Integrate with Lambda `VasukiLeaderboardHandler`.
     * `OPTIONS /leaderboard` -> Integrate with Lambda `VasukiLeaderboardHandler`.
   * Enable CORS under API settings (Allow Origins: `*`, Allow Methods: `GET, POST, OPTIONS`, Allow Headers: `Content-Type`).
   * Deploy to default stage and copy the invoke URL into `js/config.js`.
