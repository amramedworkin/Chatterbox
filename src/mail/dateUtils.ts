import { GmailMessage } from './getGmail';

/**
 * Gets the sent date from a Gmail message
 * @param message Gmail message object
 * @returns Date object or null if not available
 */
export function getEmailSentDate(message: GmailMessage): Date | null {
    if (!message.internalDate) {
        return null;
    }

    // Gmail internalDate is in milliseconds since epoch
    const timestamp = parseInt(message.internalDate, 10);
    if (isNaN(timestamp)) {
        return null;
    }

    return new Date(timestamp);
}

/**
 * Gets the received date from a Gmail message
 * @param message Gmail message object
 * @returns Date object or null if not available
 */
export function getEmailReceivedDate(message: GmailMessage): Date | null {
    // For Gmail, the received date is typically the same as the sent date
    // since Gmail stores the original timestamp when the message was received
    return getEmailSentDate(message);
}

/**
 * Formats a date for display
 * @param date Date object
 * @returns Formatted date string
 */
export function formatEmailDate(date: Date): string {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
    });
}

/**
 * Gets formatted sent date string from a Gmail message
 * @param message Gmail message object
 * @returns Formatted date string or 'Unknown' if not available
 */
export function getEmailSentDateString(message: GmailMessage): string {
    const date = getEmailSentDate(message);
    return date ? formatEmailDate(date) : 'Unknown';
}

/**
 * Gets formatted received date string from a Gmail message
 * @param message Gmail message object
 * @returns Formatted date string or 'Unknown' if not available
 */
export function getEmailReceivedDateString(message: GmailMessage): string {
    const date = getEmailReceivedDate(message);
    return date ? formatEmailDate(date) : 'Unknown';
}
