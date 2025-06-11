// src/utils/authorizeGmail.ts

import { promises as fs } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
import open from 'open'; // Import the 'open' package

import { AppConfig } from '../types/config';

// Define an interface for the token data structure, allowing null for optional properties
interface TokenData {
    [email: string]: {
        access_token: string | null;
        refresh_token: string | null;
        scope: string;
        token_type: string;
        expiry_date: number | null;
        id_token?: string | null;
    };
}

/**
 * Reads token data from a specified path.
 * @param {string} tokenPath The path to the token file.
 * @returns {Promise<TokenData>} The token data.
 */
export async function readTokenData(tokenPath: string): Promise<TokenData> {
    try {
        const content = await fs.readFile(tokenPath, 'utf8');
        return JSON.parse(content) as TokenData;
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
            return {}; // Return empty object if file doesn't exist
        }
        throw new Error(`Failed to read token data from ${tokenPath}: ${error.message}`);
    }
}

/**
 * Writes token data to a specified path.
 * @param {string} tokenPath The path to the token file.
 * @param {TokenData} tokenData The token data to write.
 */
async function writeTokenData(tokenPath: string, tokenData: TokenData): Promise<void> {
    const dir = path.dirname(tokenPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tokenPath, JSON.stringify(tokenData, null, 2));
}

/**
 * Get new access token and refresh token by prompting user for authorization code.
 * Opens the authorization URL in a browser automatically.
 * @param {OAuth2Client} oAuth2Client The OAuth2 client.
 * @param {string[]} scopes The scopes required for authorization.
 * @returns {Promise<void>}
 */
async function getNewToken(oAuth2Client: OAuth2Client, scopes: string[]): Promise<void> {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
    });

    console.log('Opening authorization URL in your browser...');
    await open(authUrl); // Open the URL in the default browser

    console.log('If the browser did not open, please visit this URL manually:');
    console.log(authUrl); // Still print the URL as a fallback

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        rl.question(
            'Please complete the authorization in your browser and paste the code here: ',
            async (code) => {
                rl.close();
                try {
                    const { tokens } = await oAuth2Client.getToken(code);
                    oAuth2Client.setCredentials(tokens);
                    resolve();
                } catch (err: unknown) {
                    const error = err as Error;
                    reject(new Error(`Error retrieving access token: ${error.message}`));
                }
            }
        );
    });
}

/**
 * Authorizes a Gmail user and returns an authenticated Gmail client.
 * @param {string} email The email address of the user.
 * @param {AppConfig} config The application configuration.
 * @returns {Promise<OAuth2Client>} An authenticated OAuth2 client.
 */
export async function authorizeGmail(email: string, config: AppConfig): Promise<OAuth2Client> {
    const credentialsPath = config.google.credentialsPath;
    const tokenPath = config.google.pollTokenPath;
    const scopes = config.google.scopes;

    let credentialsContent: string;
    try {
        credentialsContent = await fs.readFile(credentialsPath, 'utf8');
    } catch (err: unknown) {
        const error = err as Error;
        throw new Error(
            `Error loading client secret file from ${credentialsPath}: ${error.message}. Please ensure credentials.json is present.`
        );
    }

    const credentials = JSON.parse(credentialsContent);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
    ) as OAuth2Client;

    const tokenData: TokenData = await readTokenData(tokenPath);

    if (tokenData[email]) {
        oAuth2Client.setCredentials(tokenData[email]);
        try {
            // Attempt to refresh the token. If it's invalid or expired, refreshAccessToken will throw an error.
            const { credentials: refreshedTokens } = await oAuth2Client.refreshAccessToken();
            // Update the stored token data with the refreshed tokens, ensuring type compatibility
            tokenData[email] = {
                ...tokenData[email], // Keep existing properties
                ...refreshedTokens, // Update with refreshed tokens
            } as TokenData[string];
            await writeTokenData(tokenPath, tokenData);
            console.log('Token refreshed successfully.');
        } catch (err) {
            // If refresh fails, it means the token is expired or invalid, so re-authorize
            console.warn('Failed to refresh access token, or token was invalid:', err);
            console.warn('Attempting to re-authorize from scratch.');
            await getNewToken(oAuth2Client, scopes);
            tokenData[email] = oAuth2Client.credentials as TokenData[string];
            await writeTokenData(tokenPath, tokenData);
        }
    } else {
        await getNewToken(oAuth2Client, scopes);
        tokenData[email] = oAuth2Client.credentials as TokenData[string];
        await writeTokenData(tokenPath, tokenData);
    }
    return oAuth2Client;
}

// Export the writeTokenData for testing if needed
export { writeTokenData };
