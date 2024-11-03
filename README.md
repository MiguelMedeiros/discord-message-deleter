# Discord Message Deleter

A TypeScript tool to bulk delete Discord messages with rate limiting, logging, and message backup capabilities.

## Features

- 🗑️ Bulk delete messages from a specific Discord channel
- 📊 Rate limiting and throttling management
- 📝 Comprehensive logging system
- 💾 Message content backup before deletion
- ⚡ Progress tracking and statistics
- 🔒 Environment-based configuration

## Prerequisites

- Node.js (v18.x recommended)
- npm or yarn
- A Discord user token
- TypeScript

## Installation

1. Clone the repository:
```bash
git clone https://github.com/MiguelMedeiros/discord-message-deleter.git
cd discord-message-deleter
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following content. [More instructions to get variables here](https://gist.github.com/hyonschu/6ac0133deda18411bfc942c4d3c2d685#variables)
```env
DISCORD_AUTH_TOKEN=your_discord_token_here
DISCORD_AUTHOR_ID=your_user_id
DISCORD_CHANNEL_ID=target_channel_id
DISCORD_BEFORE_MESSAGE_ID=message_id_to_start_from
```

## Dependencies

### Production
- `dotenv`: ^16.4.5
- `node-fetch`: ^2.6.1

### Development
- `@types/node`: ^18.x
- `@types/node-fetch`: ^2.6.1
- `ts-node`: ^10.9.1
- `typescript`: ^4.9.5

## Usage

### Development Mode
Run directly with ts-node:
```bash
npm run dev
```

### Production Mode
1. Build the TypeScript code:
```bash
npm run build
```

2. Run the compiled JavaScript:
```bash
npm start
```

The script will:
- Create a `logs` directory if it doesn't exist
- Generate three log files:
  - `deletion_log_[timestamp].txt`: Operation logs
  - `error_log_[timestamp].txt`: Error logs
  - `messages_backup_[timestamp].txt`: Backup of deleted messages

## Project Structure
```
├── src/
│   └── index.ts
├── dist/           # Compiled JavaScript files
├── logs/          # Generated log files
│   ├── deletion_log_[timestamp].txt
│   ├── error_log_[timestamp].txt
│   └── messages_backup_[timestamp].txt
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

## Logging System

### Operation Logs
Contains information about:
- Session start/end times
- Progress updates
- Rate limit encounters
- Deletion confirmations

### Error Logs
Records any errors encountered during:
- API calls
- Message deletions
- General operation issues

### Message Backup
Stores for each message:
- Message ID
- Timestamp
- Author information
- Message content
- Attachments URLs

## Safety Features

- Rate limit handling
- Throttling protection
- Graceful interruption handling
- Environment variable validation
- Automatic error recovery

## Important Notes

- 🔒 Never share your Discord token
- 💾 Keep backups of important messages
- ⚠️ Deletions are permanent and cannot be undone
- 🕒 Respect Discord's rate limits

## Error Handling

The script handles various error scenarios:
- Rate limiting
- API errors
- Network issues
- Invalid tokens
- Missing permissions

## Support

For support, please open an issue in the GitHub repository.

## Safety Warning

⚠️ This tool can permanently delete messages. Always:
- Double-check channel IDs
- Keep backups
- Test with a small message set first
- Use with caution

## License

This project is licensed under the [MIT License](/LICENSE).

## Disclaimer

This tool is for educational purposes only. Use at your own risk. The developers are not responsible for any misuse or data loss.