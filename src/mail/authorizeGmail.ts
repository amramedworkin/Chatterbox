// src/utils/authorizeGmail.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
import chalk from 'chalk';

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
        const data = JSON.parse(content);

        // If the data has tokens at root level, migrate them to the email key
        if (data.access_token) {
            const emailKeys = Object.keys(data).filter((key) => key.includes('@'));
            const email = emailKeys.length > 0 ? emailKeys[0] : 'default';
            const migratedData: TokenData = {
                [email]: {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    scope: data.scope,
                    token_type: data.token_type,
                    expiry_date: data.expiry_date,
                    id_token: data.id_token,
                },
            };
            // Write the migrated data back to the file
            await writeTokenData(tokenPath, migratedData);
            return migratedData;
        }
        return data as TokenData;
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
 * Displays the authorization URL for manual authorization.
 * @param {OAuth2Client} oAuth2Client The OAuth2 client.
 * @param {string[]} scopes The scopes required for authorization.
 * @returns {Promise<void>}
 */
async function getNewToken(oAuth2Client: OAuth2Client, scopes: string[]): Promise<void> {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent', // Force consent screen to ensure refresh token
    });

    // Display the URL so the user can copy/paste it into a browser manually
    console.log(chalk.cyan('Authorize this app by visiting this URL:'));
    console.log(chalk.cyan(authUrl));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        rl.question(
            '2. Please complete the authorization in your browser and paste the code here: ',
            async (code) => {
                rl.close();
                try {
                    const { tokens } = await oAuth2Client.getToken(code);

                    // Log what we received for debugging
                    console.log('Received tokens from Google:');
                    console.log(`  - Access token: ${tokens.access_token ? 'Present' : 'Missing'}`);
                    console.log(
                        `  - Refresh token: ${tokens.refresh_token ? 'Present' : 'Missing'}`
                    );
                    console.log(`  - Token type: ${tokens.token_type || 'Not specified'}`);
                    console.log(`  - Expiry date: ${tokens.expiry_date || 'Not specified'}`);

                    if (!tokens.refresh_token) {
                        console.warn(
                            '⚠️  No refresh token received from Google. This may cause issues with token renewal.'
                        );
                    }

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
 * Removes the token for a specific email from the token file.
 * @param {string} tokenPath The path to the token file.
 * @param {string} email The email address whose token should be removed.
 */
export async function removeTokenForEmail(tokenPath: string, email: string): Promise<void> {
    const tokenData: TokenData = await readTokenData(tokenPath);
    if (tokenData[email]) {
        delete tokenData[email];
        await writeTokenData(tokenPath, tokenData);
    }
}

/**
 * Authorizes a Gmail user and returns an authenticated Gmail client.
 * @param {string} email The email address of the user.
 * @param {AppConfig} config The application configuration.
 * @param {boolean} force If true, removes the old token for the email before authorizing (default: false).
 * @returns {Promise<OAuth2Client>} An authenticated OAuth2 client.
 */
export async function authorizeGmail(
    email: string,
    config: AppConfig,
    force = false
): Promise<OAuth2Client> {
    console.log(`🔍 [AUTH DEBUG] Starting authorization for: ${email}`);
    console.log(`🔍 [AUTH DEBUG] Force re-authorization: ${force}`);

    const credentialsPath = config.google.credentialsPath;
    const tokenPath = config.google.pollTokenPath;
    const scopes = config.google.scopes;

    console.log(`🔍 [AUTH DEBUG] Credentials path: ${credentialsPath}`);
    console.log(`🔍 [AUTH DEBUG] Token path: ${tokenPath}`);
    console.log(`🔍 [AUTH DEBUG] Required scopes: ${scopes.join(', ')}`);

    let credentialsContent: string;
    try {
        credentialsContent = await fs.readFile(credentialsPath, 'utf8');
        console.log(`✅ [AUTH DEBUG] Credentials file loaded successfully`);
    } catch (err: unknown) {
        const error = err as Error;
        console.error(`❌ [AUTH DEBUG] Failed to load credentials: ${error.message}`);
        throw new Error(
            `Error loading client secret file from ${credentialsPath}: ${error.message}. Please ensure google_credentials.json is present.`
        );
    }

    const credentials = JSON.parse(credentialsContent);
    const { client_secret, client_id } = credentials.installed || credentials.web;
    console.log(
        `✅ [AUTH DEBUG] OAuth2 client created with client_id: ${client_id ? 'Present' : 'Missing'}`
    );

    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        config.google.redirectUri
    ) as OAuth2Client;

    // If force is true, remove the token for this email first
    if (force) {
        console.log(`🔄 [AUTH DEBUG] Force mode enabled, removing existing token for ${email}`);
        await removeTokenForEmail(tokenPath, email);
    }

    const tokenData: TokenData = await readTokenData(tokenPath);
    console.log(
        `🔍 [AUTH DEBUG] Token data loaded. Available users: ${Object.keys(tokenData).join(', ')}`
    );

    if (tokenData[email]) {
        console.log(`✅ [AUTH DEBUG] Found existing token for ${email}`);
        console.log(`🔍 [AUTH DEBUG] Token details:`);
        console.log(`  - Access token: ${tokenData[email].access_token ? 'Present' : 'Missing'}`);
        console.log(`  - Refresh token: ${tokenData[email].refresh_token ? 'Present' : 'Missing'}`);
        console.log(`  - Token type: ${tokenData[email].token_type || 'Not specified'}`);
        console.log(`  - Expiry date: ${tokenData[email].expiry_date || 'Not specified'}`);
        console.log(`  - Scope: ${tokenData[email].scope || 'Not specified'}`);

        if (tokenData[email].expiry_date !== null) {
            const expiryDate = new Date(tokenData[email].expiry_date!);
            const now = new Date();
            const isExpired = expiryDate < now;
            console.log(`  - Expiry date: ${expiryDate.toISOString()}`);
            console.log(`  - Current time: ${now.toISOString()}`);
            console.log(`  - Token expired: ${isExpired}`);
        }

        oAuth2Client.setCredentials(tokenData[email]);

        // Check if we have a refresh token
        if (!tokenData[email].refresh_token) {
            console.warn(
                `⚠️ [AUTH DEBUG] No refresh token found for ${email}. Re-authorization required.`
            );
            console.warn('🔄 [AUTH DEBUG] Attempting to re-authorize from scratch.');
            await getNewToken(oAuth2Client, scopes);

            // Save the new tokens with all fields
            const newTokens = oAuth2Client.credentials;
            console.log('💾 [AUTH DEBUG] Saving new tokens with fields:');
            console.log(`  - Access token: ${newTokens.access_token ? 'Present' : 'Missing'}`);
            console.log(`  - Refresh token: ${newTokens.refresh_token ? 'Present' : 'Missing'}`);
            console.log(`  - Token type: ${newTokens.token_type || 'Not specified'}`);
            console.log(`  - Expiry date: ${newTokens.expiry_date || 'Not specified'}`);

            tokenData[email] = newTokens as TokenData[string];
            await writeTokenData(tokenPath, tokenData);
            console.log(`✅ [AUTH DEBUG] Authorization completed successfully for ${email}`);
            return oAuth2Client;
        }

        try {
            console.log(`🔄 [AUTH DEBUG] Attempting to refresh token for ${email}...`);
            // Attempt to refresh the token. If it's invalid or expired, refreshAccessToken will throw an error.
            const { credentials: refreshedTokens } = await oAuth2Client.refreshAccessToken();
            console.log(`✅ [AUTH DEBUG] Token refresh successful for ${email}`);
            console.log(`🔍 [AUTH DEBUG] Refreshed token details:`);
            console.log(
                `  - Access token: ${refreshedTokens.access_token ? 'Present' : 'Missing'}`
            );
            console.log(
                `  - Refresh token: ${refreshedTokens.refresh_token ? 'Present' : 'Missing'}`
            );
            console.log(`  - Token type: ${refreshedTokens.token_type || 'Not specified'}`);
            console.log(`  - Expiry date: ${refreshedTokens.expiry_date || 'Not specified'}`);

            // Update the stored token data with the refreshed tokens, ensuring type compatibility
            tokenData[email] = {
                ...tokenData[email], // Keep existing properties (including refresh_token)
                ...refreshedTokens, // Update with refreshed tokens
            } as TokenData[string];
            await writeTokenData(tokenPath, tokenData);
            console.log(`💾 [AUTH DEBUG] Refreshed tokens saved to ${tokenPath}`);
        } catch (err) {
            // If refresh fails, it means the token is expired or invalid, so re-authorize
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`❌ [AUTH DEBUG] Token refresh failed for ${email}:`);
            console.error(
                `   Error type: ${err instanceof Error ? err.constructor.name : typeof err}`
            );
            console.error(`   Error message: ${errorMsg}`);

            // Log additional error details if available
            if (err instanceof Error) {
                console.error(`   Error stack: ${err.stack}`);
            }

            // Check if it's a specific Google API error
            const errorObj = err as Record<string, unknown>;
            if (errorObj && typeof errorObj === 'object' && 'code' in errorObj) {
                console.error(`   Error code: ${errorObj.code}`);
            }
            if (errorObj && typeof errorObj === 'object' && 'status' in errorObj) {
                console.error(`   HTTP status: ${errorObj.status}`);
            }

            console.warn('🔄 [AUTH DEBUG] Attempting to re-authorize from scratch.');
            await getNewToken(oAuth2Client, scopes);

            // Save the new tokens with all fields
            const newTokens = oAuth2Client.credentials;
            console.log('💾 [AUTH DEBUG] Saving new tokens with fields:');
            console.log(`  - Access token: ${newTokens.access_token ? 'Present' : 'Missing'}`);
            console.log(`  - Refresh token: ${newTokens.refresh_token ? 'Present' : 'Missing'}`);
            console.log(`  - Token type: ${newTokens.token_type || 'Not specified'}`);
            console.log(`  - Expiry date: ${newTokens.expiry_date || 'Not specified'}`);

            tokenData[email] = newTokens as TokenData[string];
            await writeTokenData(tokenPath, tokenData);
        }
    } else {
        console.log(
            `⚠️ [AUTH DEBUG] No existing token found for ${email}. Starting fresh authorization.`
        );
        await getNewToken(oAuth2Client, scopes);

        // Save the new tokens with all fields
        const newTokens = oAuth2Client.credentials;
        console.log('💾 [AUTH DEBUG] Saving new tokens with fields:');
        console.log(`  - Access token: ${newTokens.access_token ? 'Present' : 'Missing'}`);
        console.log(`  - Refresh token: ${newTokens.refresh_token ? 'Present' : 'Missing'}`);
        console.log(`  - Token type: ${newTokens.token_type || 'Not specified'}`);
        console.log(`  - Expiry date: ${newTokens.expiry_date || 'Not specified'}`);

        tokenData[email] = newTokens as TokenData[string];
        await writeTokenData(tokenPath, tokenData);
    }

    console.log(`✅ [AUTH DEBUG] Authorization completed successfully for ${email}`);
    return oAuth2Client;
}

/**
 * Validates an existing token for a Gmail user without interactive authorization
 * @param {string} email The email address of the user
 * @param {AppConfig} config The application configuration
 * @returns {Promise<{email: string, hasToken: boolean, isValid: boolean, error?: string}>} Validation result
 */
export async function validateGmailToken(
    email: string,
    config: AppConfig
): Promise<{
    email: string;
    hasToken: boolean;
    isValid: boolean;
    error?: string;
}> {
    const tokenPath = config.google.pollTokenPath;

    try {
        // Check if token file exists and has data for this email
        const tokenData: TokenData = await readTokenData(tokenPath);
        const hasToken = !!(tokenData[email] && tokenData[email].access_token);

        if (!hasToken) {
            return {
                email,
                hasToken: false,
                isValid: false,
                error: 'No token found for this email',
            };
        }

        // Check if refresh token exists
        if (!tokenData[email].refresh_token) {
            return {
                email,
                hasToken: true,
                isValid: false,
                error: 'Token exists but no refresh token found',
            };
        }

        // Try to use the token to make a test API call
        const credentialsPath = config.google.credentialsPath;
        const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsContent);
        const { client_secret, client_id } = credentials.installed || credentials.web;

        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            config.google.redirectUri
        ) as OAuth2Client;

        oAuth2Client.setCredentials(tokenData[email]);

        // Test the token by making a simple Gmail API call
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        try {
            // Try to get user profile - this will fail if token is invalid
            await gmail.users.getProfile({ userId: email });

            return {
                email,
                hasToken: true,
                isValid: true,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ [VALIDATE DEBUG] Token validation failed for ${email}:`);
            console.error(
                `   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`
            );
            console.error(`   Error message: ${errorMsg}`);

            // Log additional error details if available
            if (error instanceof Error) {
                console.error(`   Error stack: ${error.stack}`);
            }

            // Check if it's a specific Google API error
            const errorObj = error as Record<string, unknown>;
            if (errorObj && typeof errorObj === 'object' && 'code' in errorObj) {
                console.error(`   Error code: ${errorObj.code}`);
            }
            if (errorObj && typeof errorObj === 'object' && 'status' in errorObj) {
                console.error(`   HTTP status: ${errorObj.status}`);
            }

            return {
                email,
                hasToken: true,
                isValid: false,
                error: `Token validation failed: ${errorMsg}`,
            };
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
            email,
            hasToken: false,
            isValid: false,
            error: `Error reading token data: ${errorMsg}`,
        };
    }
}

/**
 * Validates all Gmail tokens defined in the config without interactive authorization
 * @param {AppConfig} config The application configuration
 * @returns {Promise<Array<{email: string, hasToken: boolean, isValid: boolean, error?: string}>>} Validation results
 */
export async function validateAllGmailTokens(config: AppConfig): Promise<
    Array<{
        email: string;
        hasToken: boolean;
        isValid: boolean;
        error?: string;
    }>
> {
    const emails = [
        config.app.defaultPollGmailUser,
        config.app.defaultSendGmailUser,
        config.app.defaultGetGmailUser,
    ].filter((email, index, arr) => email && arr.indexOf(email) === index); // Remove duplicates

    const results = [];

    for (const email of emails) {
        const result = await validateGmailToken(email, config);
        results.push(result);
    }

    return results;
}

/**
 * Validates and refreshes a Gmail token if needed, without interactive prompts
 * @param {string} email The email address of the user
 * @param {AppConfig} config The application configuration
 * @returns {Promise<{email: string, success: boolean, refreshed: boolean, error?: string}>} Result
 */
export async function validateAndRefreshToken(
    email: string,
    config: AppConfig
): Promise<{
    email: string;
    success: boolean;
    refreshed: boolean;
    error?: string;
}> {
    const tokenPath = config.google.pollTokenPath;

    try {
        // 1. Check if token exists in google_tokens.json
        const tokenData: TokenData = await readTokenData(tokenPath);
        if (!tokenData[email] || !tokenData[email].access_token) {
            return {
                email,
                success: false,
                refreshed: false,
                error: 'No token found for this email',
            };
        }

        // 2. Check if refresh token exists
        if (!tokenData[email].refresh_token) {
            return {
                email,
                success: false,
                refreshed: false,
                error: 'Token exists but no refresh token found',
            };
        }

        // 3. Check if access token is still valid
        const credentialsPath = config.google.credentialsPath;
        const credentialsContent = await fs.readFile(credentialsPath, 'utf8');
        const credentials = JSON.parse(credentialsContent);
        const { client_secret, client_id } = credentials.installed || credentials.web;

        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            config.google.redirectUri
        ) as OAuth2Client;

        oAuth2Client.setCredentials(tokenData[email]);

        // Test the token by making a simple Gmail API call
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        try {
            // Try to get user profile - this will fail if token is invalid
            await gmail.users.getProfile({ userId: email });

            // Token is still valid, no refresh needed
            return {
                email,
                success: true,
                refreshed: false,
            };
        } catch {
            // Token is invalid, try to refresh
            try {
                console.log(`🔄 Refreshing token for ${email}...`);
                const { credentials: refreshedTokens } = await oAuth2Client.refreshAccessToken();

                // Update the stored token data with the refreshed tokens
                tokenData[email] = {
                    ...tokenData[email], // Keep existing properties (including refresh_token)
                    ...refreshedTokens, // Update with refreshed tokens
                } as TokenData[string];
                await writeTokenData(tokenPath, tokenData);

                console.log(`✅ Token refreshed successfully for ${email}`);
                return {
                    email,
                    success: true,
                    refreshed: true,
                };
            } catch (refreshError) {
                const errorMsg =
                    refreshError instanceof Error ? refreshError.message : String(refreshError);
                return {
                    email,
                    success: false,
                    refreshed: false,
                    error: `Token refresh failed: ${errorMsg}`,
                };
            }
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
            email,
            success: false,
            refreshed: false,
            error: `Error during token validation: ${errorMsg}`,
        };
    }
}

// Export the writeTokenData for testing if needed
export { writeTokenData };

// CLI interface for running validation directly
if (require.main === module) {
    import('../loadConfig')
        .then(async (configModule) => {
            const config = configModule.default;

            console.log('🔍 Validating Gmail tokens...\n');

            try {
                const results = await validateAllGmailTokens(config);

                console.log('Token Validation Results:');
                console.log('========================');

                for (const result of results) {
                    console.log(`\n📧 Email: ${result.email}`);
                    console.log(`   Token exists: ${result.hasToken ? '✅ Yes' : '❌ No'}`);
                    console.log(`   Token valid: ${result.isValid ? '✅ Yes' : '❌ No'}`);
                    if (result.error) {
                        console.log(`   Error: ${result.error}`);
                    }
                }

                console.log('\n✅ Token validation complete!');
            } catch (error) {
                console.error('❌ Error during token validation:', error);
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('❌ Error loading config:', error);
            process.exit(1);
        });
}
