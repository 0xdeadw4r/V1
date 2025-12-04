# Discord VC Tracker Bot

A Discord bot that tracks voice channel time for all members, with enforced daily goals and DM reminders for staff members only.

## Features

- **Voice Channel Tracking**: Tracks join/leave times, durations, and handles channel switching
- **AFK Detection**: Automatically excludes AFK channel time from totals
- **Staff Management**: Required hours per staff member (default 6h), customizable
- **DM Reminders**: Sends reminders to staff every X hours until daily goal is met
- **Excuse System**: Staff can be excused for specific dates
- **Daily Logs**: Sends staff and user logs to configured webhooks at reset time
- **Session Recovery**: Recovers active sessions after bot restart
- **Midnight Splitting**: Automatically splits sessions across midnight

## Commands

### Staff Management (Admin only)
- `/staff add @user` - Add a user as staff
- `/staff remove @user` - Remove a user from staff
- `/staff hours @user 6` - Set required hours for a staff member
- `/staff status @user` - Check a staff member's status
- `/staff reminder 3` - Set reminder interval (hours)
- `/staff excuse @user 2025-01-03 "reason"` - Excuse a staff member for a day
- `/staff list` - List all staff members

### Configuration (Admin only)
- `/set webhook-staff <url>` - Set staff log webhook URL
- `/set webhook-users <url>` - Set users log webhook URL
- `/set timezone Asia/Kolkata` - Set timezone
- `/set reset 00:00` - Set daily reset time
- `/set afk-channel <channel>` - Set AFK channel
- `/set talking-mode true/false` - Toggle active talking mode

### Queries
- `/check @user` - Check VC time for a user
- `/logs staff` - Get staff logs (JSON/CSV)
- `/logs users` - Get users logs (JSON/CSV)
- `/logs top week/month` - Get top VC users

### Time Adjustments (Admin only)
- `/fix add @user 10 "reason"` - Add time to a user
- `/fix remove @user 5 "reason"` - Remove time from a user

## Web Dashboard

The bot includes a professional web dashboard for monitoring and management:

- **Login**: Username `admin`, Password `Prayagkaushik4`
- **Dashboard Features**:
  - Real-time bot status and statistics
  - Staff member management
  - Whitelisted users management
  - Guild configuration settings
  - Active voice session monitoring
  - Live updates via Socket.IO (secured)
- **Public Status Page**: `/status` endpoint for UptimeRobot monitoring

### Dashboard Routes
- `/` - Main dashboard (requires login)
- `/status` - Public status page for uptime monitoring
- `/api/stats` - Bot statistics
- `/api/staff` - Staff management
- `/api/whitelist` - Whitelist management
- `/api/sessions` - Active sessions
- `/api/guild-config` - Guild configuration

## Environment Variables

- `DISCORD_BOT_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Discord application client ID
- `MONGODB_URI` - MongoDB connection string
- `SESSION_SECRET` - Session encryption secret (recommended for production)

## Project Structure

```
src/
├── index.ts              # Main bot entry point
├── config/
│   └── database.ts       # MongoDB connection
├── models/
│   ├── Session.ts        # Voice session model
│   ├── Staff.ts          # Staff member model
│   ├── GuildConfig.ts    # Server configuration
│   ├── Adjustment.ts     # Time adjustments
│   └── index.ts
├── services/
│   ├── VoiceTracker.ts   # Voice state tracking
│   ├── ReminderService.ts # DM reminders
│   └── SchedulerService.ts # Daily reset scheduling
├── commands/
│   ├── staff.ts          # Staff management commands
│   ├── set.ts            # Configuration commands
│   ├── check.ts          # Check command
│   ├── logs.ts           # Logs commands
│   ├── fix.ts            # Time adjustment commands
│   └── index.ts
└── utils/
    ├── time.ts           # Time utilities
    └── webhook.ts        # Webhook utilities
```

## Database (MongoDB)

Uses MongoDB with the following collections:
- `sessions` - Voice channel session records
- `staff` - Staff member records with requirements
- `guildconfigs` - Per-server configuration
- `adjustments` - Manual time adjustments
- `discounts` - Time-limited discount configurations
- `customembeds` - Custom embed configurations

## Discount System

The dashboard includes a discount management system:

- **Create Discounts**: Add time-limited percentage discounts
- **Live Updates**: Discounts update in real-time via Socket.IO when created/modified/deleted
- **Status Tracking**: Shows Active, Scheduled, Expired, or Disabled status
- **Auto-Apply**: Discounts automatically apply to embed prices when active
- **Per-Embed Discounts**: Assign specific discounts to individual embeds instead of using global discounts

### Discount-Embed Linking

When creating discounts, you can assign them to specific embeds:
- **Apply to Embed Dropdown**: In the "Add Discount" modal, select which embed the discount applies to
- **Applies To Column**: The discounts table shows which embed each discount is for (Global, specific embed name, or Invalid)
- **Global Discounts**: Leave the embed selection empty to apply the discount globally to all embeds

## Recent Updates (December 2025)

- Added per-embed discount assignment feature
- Fixed template literal syntax errors in dashboard frontend
- Added live Socket.IO updates for discount changes
- Improved discount status display with accurate time checking
- Fixed timezone handling in time utilities
