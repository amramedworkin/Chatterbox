import { google } from 'googleapis';
import { OAuth2Client } from 'googleapis-common';
import config from '../loadConfig';
import { authorizeGmail } from './authorizeGmail';

/**
 * Lists Gmail message IDs containing 'chatterbox' in the subject line.
 * The search is limited to the last `daysToSearch` days.
 *
 * @param daysToSearch Number of days back to search. Defaults to 7.
 * @param userEmail Optional Gmail account to search; defaults to config.app.defaultPollGmailUser
 * @returns Promise resolving to an array of message IDs
 */
export async function listGmails(daysToSearch = 7, userEmail?: string): Promise<string[]> {
    const gmailUser = userEmail || config.app.defaultPollGmailUser;
    const auth: OAuth2Client = await authorizeGmail(gmailUser, config);
    const gmail = google.gmail({ version: 'v1', auth });

    const queryParts: string[] = ['subject:chatterbox'];
    if (daysToSearch > 0) {
        const days = Math.floor(daysToSearch);
        queryParts.push(`newer_than:${days}d`);
    }
    const q = queryParts.join(' ');

    const messageIds: string[] = [];
    let pageToken: string | undefined;

    do {
        const res = await gmail.users.messages.list({
            userId: gmailUser,
            q,
            pageToken,
        });

        if (res.data.messages) {
            for (const msg of res.data.messages) {
                if (msg.id) {
                    messageIds.push(msg.id);
                }
            }
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return messageIds;
}

// Run as a script: ts-node src/utils/listGmails.ts [days]
if (require.main === module) {
    const arg = process.argv[2];
    const days = arg ? parseInt(arg, 10) : undefined;
    listGmails(days)
        .then((ids) => {
            console.log(ids.join('\n'));
        })
        .catch((err) => {
            console.error('Error listing Gmail messages:', err);
            process.exit(1);
        });
}
