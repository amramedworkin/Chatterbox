// authorizeGmail.js
// Import necessary libraries.
const { google } = require('googleapis');
const fs = require('fs').promises;
const readline = require('readline');
const path = require('path');

// --- Global Timestamp Formatter (re-defined locally for standalone use) ---
let timestampFormatter = null;

/**
 * Generates a formatted timestamp string in 'yyyymmdd:hhMMss:' (US Eastern Time).
 * @returns {string} The formatted timestamp.
 */
function getTimestamp() {
    if (!timestampFormatter) {
        timestampFormatter = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false, // 24-hour format
            timeZone: 'America/New_York', // US Eastern Time
        });
    }

    const now = new Date();
    const parts = timestampFormatter.formatToParts(now);

    const year = parts.find((p) => p.type === 'year').value;
    const month = parts.find((p) => p.type === 'month').value;
    const day = parts.find((p) => p.type === 'day').value;
    const hour = parts.find((p) => p.type === 'hour').value;
    const minute = parts.find((p) => p.type === 'minute').value;
    const second = parts.find((p) => p.type === 'second').value;

    return `${year}${month}${day}:${hour}${minute}${second}:`;
}

/**
 * Logs messages to the console with a prepended timestamp.
 * @param {...any} args The arguments to log.
 */
function logWithTimestamp(...args) {
    console.log(getTimestamp(), ...args);
}

/**
 * Checks if a file exists asynchronously.
 * @param {string} filePath The path to the file.
 * @returns {Promise<boolean>} True if file exists, false otherwise.
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Reads the token data from token.json.
 * @returns {Promise<object>} The token data object, or an empty object if not found or invalid.
 */
async function readTokenData(tokenPath) {
    try {
        if (await fileExists(tokenPath)) {
            const tokenContent = await fs.readFile(tokenPath, 'utf8');
            return JSON.parse(tokenContent);
        }
    } catch (err) {
        logWithTimestamp('Error reading token file:', err.message);
    }
    return {};
}

/**
 * Writes the token data to token.json.
 * @param {object} tokenData The token data object to write.
 */
async function writeTokenData(tokenData, tokenPath) {
    try {
        // Ensure the directory exists
        await fs.mkdir(path.dirname(tokenPath), { recursive: true });
        await fs.writeFile(tokenPath, JSON.stringify(tokenData, null, 2), 'utf8');
    } catch (err) {
        logWithTimestamp('Error writing token file:', err.message);
    }
}

/**
 * Get and store new token after prompting for user authorization.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {string} gmailUser The email address being authorized.
 * @param {object} config The configuration object.
 * @param {string} tokenName The name under which to store the token.
 */
async function getNewToken(oAuth2Client, gmailUser, config, tokenName) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Request a refresh token
        scope: config.google.scopes, // Use scopes from config
    });
    logWithTimestamp(`Authorize this app for ${gmailUser} by visiting this URL:`);
    logWithTimestamp(authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        rl.question('Enter the code from that page here: ', async (code) => {
            rl.close();
            try {
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);

                // Read existing tokens, add the new one, then write back
                const tokenData = await readTokenData(config.google.pollTokenPath);
                tokenData[tokenName] = tokens; // Store token under the provided name
                await writeTokenData(tokenData, config.google.pollTokenPath);

                logWithTimestamp(
                    `Tokens for '${tokenName}' stored to ${config.google.pollTokenPath}`
                );
                resolve(oAuth2Client);
            } catch (err) {
                logWithTimestamp('Error retrieving access token', err);
                reject(err);
            }
        });
    });
}

/**
 * Authorizes the Gmail client.
 * @param {string} gmailUser The email address to authorize.
 * @param {object} config The configuration object.
 * @param {string} [tokenName] Optional. The name to use for storing/retrieving the token. Defaults to gmailUser.
 * @returns {Promise<google.auth.OAuth2>} An authorized OAuth2 client.
 */
async function authorizeGmail(gmailUser, config, tokenName = gmailUser) {
    let oAuth2Client;
    try {
        const credentials = await fs.readFile(config.google.credentialsPath);
        const { client_secret, client_id, redirect_uris } = JSON.parse(credentials).installed;

        logWithTimestamp(`Using credentials from ${config.google.credentialsPath}`);
        logWithTimestamp(`Authorizing client for ${gmailUser}...`);
        logWithTimestamp(`redirect_uris ${redirect_uris}...`);

        oAuth2Client = new google.auth.OAuth2(client_id, client_secret, config.google.redirectUri);

        // Check if we have previously stored tokens for this specific user/tokenName
        const tokenData = await readTokenData(config.google.pollTokenPath);
        const storedTokens = tokenData[tokenName];

        if (storedTokens) {
            oAuth2Client.setCredentials(storedTokens);
            logWithTimestamp(`Using existing tokens for '${tokenName}' (${gmailUser}).`);
        } else {
            // If no tokens for this user, get new ones
            await getNewToken(oAuth2Client, gmailUser, config, tokenName);
        }
        return oAuth2Client;
    } catch (err) {
        logWithTimestamp('Error loading client secret file or authorizing:', err);
        throw err;
    }
}

// Export the authorization function
module.exports = { authorizeGmail, readTokenData, writeTokenData };
