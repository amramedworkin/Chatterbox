import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
    logId: number;
    sequence: number;
    timestamp: string;
    user: string;
    actionType: string;
    action: string;
    notes: string;
}

export class AdminLogger {
    private static instance: AdminLogger;
    private logFilePath: string;
    private currentLogId: number = 0;
    private logFileHandle: number | null = null;

    private constructor() {
        // Create logs directory if it doesn't exist
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        this.logFilePath = path.join(logsDir, 'admin.log');
        this.initializeLogFile();
        this.loadCurrentLogId();
    }

    public static getInstance(): AdminLogger {
        if (!AdminLogger.instance) {
            AdminLogger.instance = new AdminLogger();
        }
        return AdminLogger.instance;
    }

    private initializeLogFile(): void {
        // Create log file if it doesn't exist
        if (!fs.existsSync(this.logFilePath)) {
            fs.writeFileSync(this.logFilePath, '');
            // Set read-only permissions (owner can write, others can only read)
            fs.chmodSync(this.logFilePath, 0o644);
        }
    }

    private loadCurrentLogId(): void {
        try {
            const content = fs.readFileSync(this.logFilePath, 'utf8');
            const lines = content.split('\n').filter((line) => line.trim());

            if (lines.length > 0) {
                // Parse the last line to get the current log ID
                const lastLine = lines[lines.length - 1];
                const match = lastLine.match(/\|\s*(\d{5})-\d{3}\s*\|/);
                if (match) {
                    this.currentLogId = parseInt(match[1], 10);
                }
            }
        } catch {
            console.error('Error loading current log ID');
            this.currentLogId = 0;
        }
    }

    private getNextLogId(): number {
        return ++this.currentLogId;
    }

    private formatLogId(logId: number, sequence: number): string {
        return `${logId.toString().padStart(5, '0')}-${sequence.toString().padStart(3, '0')}`;
    }

    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    private getUser(): string {
        return process.env.USER || process.env.USERNAME || 'unknown';
    }

    private escapePipeDelimiters(text: string): string {
        return text.replace(/\|/g, '\\|');
    }

    private formatLogLine(entry: LogEntry): string {
        const formattedLogId = this.formatLogId(entry.logId, entry.sequence);
        const escapedAction = this.escapePipeDelimiters(entry.action);
        const escapedNotes = this.escapePipeDelimiters(entry.notes);

        return `| ${formattedLogId} | ${entry.timestamp} | ${entry.user} | ${entry.actionType} | ${escapedAction} | ${escapedNotes} |`;
    }

    private writeToLog(line: string): void {
        try {
            fs.appendFileSync(this.logFilePath, line + '\n');
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    public log(actionType: string, action: string, notes: string = ''): void {
        const logId = this.getNextLogId();
        const entry: LogEntry = {
            logId,
            sequence: 0,
            timestamp: this.formatTimestamp(),
            user: this.getUser(),
            actionType,
            action,
            notes,
        };

        const logLine = this.formatLogLine(entry);
        this.writeToLog(logLine);
    }

    public logMultiLine(actionType: string, action: string, notes: string): void {
        const logId = this.getNextLogId();
        const lines = notes.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length === 0) {
            // Single line log
            this.log(actionType, action, notes);
            return;
        }

        // First line with action
        const firstEntry: LogEntry = {
            logId,
            sequence: 0,
            timestamp: this.formatTimestamp(),
            user: this.getUser(),
            actionType,
            action,
            notes: lines[0] || '',
        };

        const firstLogLine = this.formatLogLine(firstEntry);
        this.writeToLog(firstLogLine);

        // Additional lines with sequence numbers
        for (let i = 1; i < lines.length; i++) {
            const additionalEntry: LogEntry = {
                logId,
                sequence: i,
                timestamp: this.formatTimestamp(),
                user: this.getUser(),
                actionType: '',
                action: '',
                notes: lines[i] || '',
            };

            const additionalLogLine = this.formatLogLine(additionalEntry);
            this.writeToLog(additionalLogLine);
        }
    }

    public getLogPath(): string {
        return this.logFilePath;
    }

    public getRecentEntries(count: number = 50): LogEntry[] {
        try {
            const content = fs.readFileSync(this.logFilePath, 'utf8');
            const lines = content.split('\n').filter((line) => line.trim());

            const entries: LogEntry[] = [];
            for (let i = Math.max(0, lines.length - count); i < lines.length; i++) {
                const entry = this.parseLogLine(lines[i]);
                if (entry) {
                    entries.push(entry);
                }
            }

            return entries.reverse(); // Most recent first
        } catch {
            console.error('Error reading log entries');
            return [];
        }
    }

    private parseLogLine(line: string): LogEntry | null {
        try {
            const match = line.match(
                /\|\s*(\d{5})-(\d{3})\s*\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|/
            );
            if (!match) return null;

            return {
                logId: parseInt(match[1], 10),
                sequence: parseInt(match[2], 10),
                timestamp: match[3].trim(),
                user: match[4].trim(),
                actionType: match[5].trim(),
                action: match[6].trim(),
                notes: match[7].trim(),
            };
        } catch {
            return null;
        }
    }
}

// Convenience functions for common logging patterns
export const adminLog = AdminLogger.getInstance();

export function logInfo(action: string, notes: string = ''): void {
    adminLog.log('info', action, notes);
}

export function logBuild(action: string, notes: string = ''): void {
    adminLog.log('build', action, notes);
}

export function logTeardown(action: string, notes: string = ''): void {
    adminLog.log('teardown', action, notes);
}

export function logValidate(action: string, notes: string = ''): void {
    adminLog.log('validate', action, notes);
}

export function logClean(action: string, notes: string = ''): void {
    adminLog.log('clean', action, notes);
}

export function logDeploy(action: string, notes: string = ''): void {
    adminLog.log('deploy', action, notes);
}

export function logMigrate(action: string, notes: string = ''): void {
    adminLog.log('migrate', action, notes);
}

export function logTest(action: string, notes: string = ''): void {
    adminLog.log('test', action, notes);
}

export function logError(action: string, notes: string = ''): void {
    adminLog.log('error', action, notes);
}

export function logWarning(action: string, notes: string = ''): void {
    adminLog.log('warning', action, notes);
}

export function logMultiLineInfo(action: string, notes: string): void {
    adminLog.logMultiLine('info', action, notes);
}

export function logMultiLineBuild(action: string, notes: string): void {
    adminLog.logMultiLine('build', action, notes);
}

export function logMultiLineTeardown(action: string, notes: string): void {
    adminLog.logMultiLine('teardown', action, notes);
}
