import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface MessageAuthor {
    id: string;
    username?: string;
}

interface Message {
    id: string;
    author: MessageAuthor;
    type: number;
    hit: boolean;
    content?: string;
    timestamp?: string;
    attachments?: any[];
}

interface SearchResponse {
    total_results: number;
    messages: Message[][];
}

class DiscordMessageDeleter {
    private authToken: string;
    private authorId: string;
    private channelId: string;
    private beforeMessageId?: string;
    private logFile: string;
    private errorLogFile: string;
    private messagesLogFile: string;

    private delayDelete = 1000;
    private delaySearch = 1500;
    private lastApiCall = 0;
    private rateLimit = 1000;

    private stats = {
        delCount: 0,
        failCount: 0,
        throttledCount: 0,
        throttledTotalTime: 0,
        grandTotal: 0,
        startTime: new Date()
    };

    constructor(authToken: string, authorId: string, channelId: string, beforeMessageId?: string) {
        this.authToken = authToken;
        this.authorId = authorId;
        this.channelId = channelId;
        this.beforeMessageId = beforeMessageId;

        // Create logs folder if it doesn't exist
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }

        // Set log file names with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFile = path.join(logsDir, `deletion_log_${timestamp}.txt`);
        this.errorLogFile = path.join(logsDir, `error_log_${timestamp}.txt`);
        this.messagesLogFile = path.join(logsDir, `messages_backup_${timestamp}.txt`);

        // Initialize log files with header
        this.writeToLog('=== Deletion Session Start ===');
        this.writeToLog(`Date/Time: ${new Date().toLocaleString()}`);
        this.writeToLog(`Channel: ${this.channelId}`);
        this.writeToLog(`Author: ${this.authorId}`);
        if (this.beforeMessageId) {
            this.writeToLog(`Deleting messages before ID: ${this.beforeMessageId}`);
        }
        this.writeToLog('=====================================\n');

        // Initialize message backup file with header
        fs.writeFileSync(
            this.messagesLogFile,
            `=== Message Backup - ${new Date().toLocaleString()} ===\n` +
            `Channel: ${this.channelId}\n` +
            `Author: ${this.authorId}\n` +
            '=====================================\n\n'
        );
    }

    public writeToLog(message: string, isError: boolean = false): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        
        // Write to console
        if (isError) {
            console.error(message);
        } else {
            console.log(message);
        }

        // Write to file
        fs.appendFileSync(
            isError ? this.errorLogFile : this.logFile,
            logMessage
        );
    }

    private saveMessageContent(message: Message): void {
        const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleString() : 'Unknown date';
        const author = message.author.username || message.author.id;
        let messageLog = `\n=== Message ID: ${message.id} ===\n`;
        messageLog += `Date: ${timestamp}\n`;
        messageLog += `Author: ${author}\n`;
        messageLog += `Content: ${message.content || '[no content]'}\n`;
        
        if (message.attachments && message.attachments.length > 0) {
            messageLog += 'Attachments:\n';
            message.attachments.forEach((attachment: any, index: number) => {
                messageLog += `  ${index + 1}. ${attachment.url || attachment.proxy_url || '[URL not available]'}\n`;
            });
        }
        
        messageLog += '-------------------\n';

        fs.appendFileSync(this.messagesLogFile, messageLog);
    }

    private async wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastApiCall;
        
        if (timeSinceLastCall < this.rateLimit) {
            const waitTime = this.rateLimit - timeSinceLastCall;
            await this.wait(waitTime);
        }
        
        this.lastApiCall = Date.now();
    }

    private msToHMS(ms: number): string {
        return `${Math.floor(ms / 3.6e6)}h ${Math.floor((ms % 3.6e6) / 6e4)}m ${Math.floor((ms % 6e4) / 1000)}s`;
    }

    private async fetchMessages(): Promise<SearchResponse> {
        await this.enforceRateLimit();

        const headers = {
            "Authorization": this.authToken
        };

        const searchParams = new URLSearchParams({
            author_id: this.authorId
        });

        if (this.beforeMessageId) {
            searchParams.append('max_id', this.beforeMessageId);
        }

        const baseURL = `https://discordapp.com/api/v6/channels/${this.channelId}/messages/search?${searchParams}`;
        const response = await fetch(baseURL, { headers });

        if (response.status === 202) {
            const data = await response.json();
            this.writeToLog(`Channel not indexed, waiting ${data.retry_after}ms...`);
            await this.wait(data.retry_after);
            return this.fetchMessages();
        }

        if (response.status === 429) {
            const data = await response.json();
            this.stats.throttledCount++;
            this.stats.throttledTotalTime += data.retry_after;
            this.writeToLog(`Rate limit reached! Waiting ${data.retry_after}ms...`);
            await this.wait(data.retry_after);
            return this.fetchMessages();
        }

        if (!response.ok) {
            throw new Error(`API responded with status ${response.status}`);
        }

        return response.json();
    }

    private async deleteMessage(messageId: string): Promise<void> {
        await this.enforceRateLimit();

        const headers = {
            "Authorization": this.authToken
        };

        const baseURL = `https://discordapp.com/api/v6/channels/${this.channelId}/messages/`;

        const response = await fetch(baseURL + messageId, {
            headers,
            method: "DELETE"
        });

        if (response.status === 429) {
            const data = await response.json();
            this.stats.throttledCount++;
            this.stats.throttledTotalTime += data.retry_after;
            this.writeToLog(`Rate limit on deletion! Waiting ${data.retry_after}ms...`);
            await this.wait(data.retry_after);
            return this.deleteMessage(messageId);
        }

        if (!response.ok) {
            throw new Error(`Failed to delete message ${messageId}: ${response.status}`);
        }
        
        this.beforeMessageId = messageId;
        this.writeToLog(`Message ${messageId} successfully deleted!`);
    }

    public async deleteMessages(): Promise<void> {
        this.writeToLog(`Starting deletion at ${this.stats.startTime.toLocaleString()}`);

        try {
            while (true) {
                const result = await this.fetchMessages();

                if (!this.stats.grandTotal) {
                    this.stats.grandTotal = result.total_results;
                    this.writeToLog(`Total messages found: ${this.stats.grandTotal}`);
                }

                if (result.total_results === 0) break;

                for (const messageGroup of result.messages) {
                    for (const message of messageGroup) {
                        if (message.type === 3) continue;

                        if (message.author.id === this.authorId && message.hit) {
                            const progress = ((this.stats.delCount + 1) / this.stats.grandTotal * 100).toFixed(2);
                            this.writeToLog(`${progress}% (${this.stats.delCount + 1}/${this.stats.grandTotal}) Deleting ID:${message.id}`);

                            try {
                                // Save message content before deleting
                                this.saveMessageContent(message);
                                
                                await this.deleteMessage(message.id);
                                this.stats.delCount++;
                                await this.wait(this.delayDelete);
                            } catch (error) {
                                const errorMessage = `Error deleting message ${message.id}: ${error}`;
                                this.writeToLog(errorMessage, true);
                                this.stats.failCount++;
                            }
                        }
                    }
                }

                await this.wait(this.delaySearch);

                if (this.stats.delCount >= this.stats.grandTotal) break;
            }

            this.printSummary();
        } catch (error) {
            const errorMessage = `Error during processing: ${error}`;
            this.writeToLog(errorMessage, true);
            this.printSummary();
            throw error;
        }
    }

    public printSummary(): void {
        const endTime = new Date();
        const totalTime = endTime.getTime() - this.stats.startTime.getTime();

        const summary = [
            '\n---- Completed! ----',
            `End at ${endTime.toLocaleString()}`,
            `Total time: ${this.msToHMS(totalTime)}`,
            `Rate limits: ${this.stats.throttledCount} times. Total wait time: ${this.msToHMS(this.stats.throttledTotalTime)}`,
            `Your messages deleted: ${this.stats.delCount}`,
            `Deletion failures: ${this.stats.failCount}`,
            `Message backup saved at: ${this.messagesLogFile}`,
            '-------------------'
        ].join('\n');

        this.writeToLog(summary);
    }
}

// Script usage
const run = async () => {

    const deleter = new DiscordMessageDeleter(
        process.env.DISCORD_AUTH_TOKEN!,
        process.env.DISCORD_AUTHOR_ID!,
        process.env.DISCORD_CHANNEL_ID!,
        process.env.DISCORD_BEFORE_MESSAGE_ID
    );
    process.on('SIGINT', () => {
        deleter.writeToLog('\nInterruption detected. Finalizing...');
        deleter.printSummary();
        process.exit();
    });

    await deleter.deleteMessages();
};

run().catch(error => {
    console.error('Fatal error:', error);
});