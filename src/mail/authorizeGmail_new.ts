// src/utils/authorizeGmail.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
import chalk from 'chalk';

import { AppConfig } from '../types/config';

// Helper function to generate timestamp in yyyymmdd_hhmmss format
function generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Define an interface for the token data structure, allowing null for optional properties
interface TokenData {
    [email: string]: {
        access_token: string | null;
        refresh_token: string | null;
        scope: string;
        token_type: string;
        expiry_date: number | null;
        id_token?: string | null;
        last_updated?: string; // Format: yyyymmdd_hhmmss
    };
} 