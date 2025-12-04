import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  Collection,
  ChatInputCommandInteraction,
  Message
} from 'discord.js';
import express from 'express';
import session from 'express-session';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { connectDatabase } from './config/database';
import {
  commands,
  checkCommand,
  logsCommand,
  setCommand,
  staffCommand,
  fixCommand,
  remindCommand,
  genzauthCommand,
  leaderboardCommand,
  mytimeCommand,
  whitelistCommand,
  statsCommand,
  dashboardCommand
} from './commands';
import { VoiceTracker } from './services/VoiceTracker';
import { ReminderService } from './services/ReminderService';
import { SchedulerService } from './services/SchedulerService';
import { AudioMonitor } from './services/AudioMonitor';
import { YouTubeMonitor } from './services/YouTubeMonitor';
import { FileWhitelist, Session as SessionModel } from './models';
import { createDashboardRoutes } from './dashboard/routes';
import { dashboardHTML } from './dashboard/frontend';
import { calculateSessionDuration } from './utils/time';

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer);
const PORT = process.env.PORT || '5000';

let botStartTime: Date | null = null;

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'bot-dashboard-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  rolling: true
});

app.use(express.json());
app.use(sessionMiddleware);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commandCollection = new Collection<string, any>();
commands.forEach(cmd => commandCollection.set(cmd.data.name, cmd));

let voiceTracker: VoiceTracker;
let reminderService: ReminderService;
let schedulerService: SchedulerService;
let audioMonitor: AudioMonitor;
let youtubeMonitor: YouTubeMonitor;

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(dashboardHTML);
});

// Health check endpoint for uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: botStartTime ? Math.floor((Date.now() - botStartTime.getTime()) / 1000) : 0,
    bot: client.isReady() ? 'online' : 'offline',
    timestamp: new Date().toISOString()
  });
});

app.use(createDashboardRoutes(client, () => botStartTime, io));

io.use((socket, next) => {
  sessionMiddleware(socket.request as any, {} as any, next as any);
});

io.on('connection', (socket) => {
  const session = (socket.request as any).session;
  if (!session || !session.authenticated) {
    socket.disconnect();
    return;
  }

  console.log('Dashboard client connected (authenticated)');

  const sendStats = async () => {
    try {
      const uptime = botStartTime ? Math.floor((Date.now() - botStartTime.getTime()) / 1000) : 0;
      const activeSessions = await SessionModel.find({ isActive: true });

      const enrichedSessions = await Promise.all(activeSessions.map(async (session) => {
        let username = session.odcordId;
        let avatar = null;
        try {
          const user = await client.users.fetch(session.odcordId);
          username = user.username;
          avatar = user.displayAvatarURL();
        } catch {}

        return {
          ...session.toObject(),
          username,
          avatar,
          currentDuration: calculateSessionDuration(session.joinTime, new Date())
        };
      }));

      socket.emit('stats', {
        isOnline: client.isReady(),
        ping: client.ws.ping,
        uptime,
        guilds: client.guilds.cache.size,
        users: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
        botName: client.user?.tag || 'Bot',
        botAvatar: client.user?.displayAvatarURL(),
        guildList: client.guilds.cache.map(g => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
          icon: g.iconURL()
        }))
      });

      socket.emit('activeSessions', enrichedSessions);
    } catch (error) {
      console.error('Socket stats error:', error);
    }
  };

  sendStats();
  const statsInterval = setInterval(sendStats, 5000);

  socket.on('disconnect', () => {
    clearInterval(statsInterval);
    console.log('Dashboard client disconnected');
  });
});

async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    throw new Error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');

    const commandData = commands.map(cmd => cmd.data.toJSON());

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData }
    );

    console.log('Successfully registered slash commands');
  } catch (error) {
    console.error('Error registering commands:', error);
    throw error;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  botStartTime = new Date();
  console.log('Bot is ready and tracking voice channels');

  // Register commands
  await registerCommands();
});

// Handle button interactions for channel redirects
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('channel_redirect_')) {
    const targetChannelId = interaction.customId.replace('channel_redirect_', '');

    try {
      await interaction.reply({
        content: `Please visit <#${targetChannelId}> to proceed.`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Button interaction error:', error);
    }
  }
});

// Emit voice state changes to dashboard
client.on('voiceStateUpdate', async () => {
  try {
    const activeSessions = await SessionModel.find({ isActive: true });
    const enrichedSessions = await Promise.all(activeSessions.map(async (session) => {
      let username = session.odcordId;
      let avatar = null;
      try {
        const user = await client.users.fetch(session.odcordId);
        username = user.username;
        avatar = user.displayAvatarURL();
      } catch {}

      return {
        ...session.toObject(),
        username,
        avatar,
        currentDuration: calculateSessionDuration(session.joinTime, new Date())
      };
    }));

    io.emit('activeSessions', enrichedSessions);
  } catch (error) {
    console.error('Error broadcasting voice state:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const commandHandlers: Record<string, any> = {
    set: setCommand,
    staff: staffCommand,
    leaderboard: leaderboardCommand,
    mytime: mytimeCommand,
    whitelist: whitelistCommand,
    check: checkCommand,
    fix: fixCommand,
    stats: statsCommand,
    logs: logsCommand,
    remind: remindCommand,
    dashboard: dashboardCommand,
    genzauth: genzauthCommand
  };

  const command = commandHandlers[interaction.commandName];

  if (!command) return;

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error) {
    console.error('Command error:', error);

    try {
      const errorMessage = 'There was an error executing this command.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
});

client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  // Check if message has attachments
  if (message.attachments.size === 0) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  // Bot owner can always upload restricted files
  if (userId === process.env.BOT_OWNER_ID) return;

  // Check if user is whitelisted
  const isWhitelisted = await FileWhitelist.findOne({ guildId, userId });
  if (isWhitelisted) return;

  // Check for .zip or .rar files
  const hasRestrictedFile = message.attachments.some(attachment => {
    const fileName = attachment.name.toLowerCase();
    return fileName.endsWith('.zip') || fileName.endsWith('.rar');
  });

  if (hasRestrictedFile) {
    try {
      // Ensure it's a guild text channel
      if (!message.channel.isTextBased() || message.channel.isDMBased()) return;

      // Check if bot has permission to manage messages
      const botMember = message.guild.members.me;
      if (!botMember) {
        console.error('Bot member not found in guild');
        return;
      }

      const permissions = message.channel.permissionsFor(botMember);
      const channelName = 'name' in message.channel ? message.channel.name : 'unknown';
      console.log(`[File Check] User: ${message.author.tag}, Channel: ${channelName}`);
      console.log(`[Permissions] ManageMessages: ${permissions?.has('ManageMessages')}, Administrator: ${permissions?.has('Administrator')}`);

      const canManageMessages = permissions?.has('ManageMessages') || permissions?.has('Administrator');

      if (!canManageMessages) {
        const channelName = 'name' in message.channel ? message.channel.name : 'unknown';
        console.error(`Missing ManageMessages permission in ${message.guild.name} - ${channelName}`);

        // Try to send a warning even if we can't delete
        if (message.channel.isSendable()) {
          await message.channel.send(
            `<@${userId}>, you are not authorized to upload .zip or .rar files. Please remove this message manually (Bot lacks delete permissions).`
          );
        }
        return;
      }

      // Log the files being deleted
      const fileNames = message.attachments.map(a => a.name).join(', ');
      console.log(`[Deleting] Files: ${fileNames}`);

      // Delete the message with the restricted file
      await message.delete();
      const channelName2 = 'name' in message.channel ? message.channel.name : 'unknown';
      console.log(`Successfully deleted restricted file from ${message.author.tag} in ${message.guild.name}`);

      // Send a warning message (check if channel supports sending messages)
      if (message.channel.isSendable()) {
        const warningMsg = await message.channel.send(
          `<@${userId}>, you are not authorized to upload .zip or .rar files. Your message has been removed.`
        );

        // Delete the warning after 5 seconds
        setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
      }
    } catch (error: any) {
      // If message was already deleted or doesn't exist, don't notify
      if (error.code === 10008) {
        console.log(`Message already deleted or not found for ${message.author.tag}`);
        return;
      }

      console.error('Error deleting restricted file:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        httpStatus: error.httpStatus,
        method: error.method,
        guild: message.guild.name,
        channel: message.channel.name,
        messageId: message.id,
        authorId: userId
      });

      // Notify in channel if deletion failed for other reasons
      if (message.channel.isSendable()) {
        try {
          await message.channel.send(
            `<@${userId}>, you are not authorized to upload .zip or .rar files. Failed to delete message - please remove it manually.`
          );
        } catch {}
      }
    }
  }
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function fixDiscountDates(): Promise<void> {
  try {
    const { Discount, GuildConfig } = await import('./models');
    const discounts = await Discount.find({});
    console.log(`Found ${discounts.length} discounts to check`);

    let fixed = 0;
    for (const discount of discounts) {
      // Get guild timezone
      const config = await GuildConfig.findOne({ guildId: discount.guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';

      const now = new Date();
      console.log(`Discount ${discount._id} (${timezone}):`);
      console.log(`  - Start: ${discount.startDate.toISOString()}`);
      console.log(`  - End: ${discount.endDate.toISOString()}`);
      console.log(`  - Now: ${now.toISOString()}`);
      console.log(`  - isActive: ${discount.isActive}`);

      // Dates are already in UTC, just verify they're set correctly
      // No changes needed - dates should be stored in UTC
    }

    console.log('Discount dates verified');
  } catch (error) {
    console.error('Error checking discount dates:', error);
  }
}

async function main(): Promise<void> {
  try {
    await connectDatabase();
    console.log('Database connected');

    // Fix any existing discounts with incorrect end times
    await fixDiscountDates();

    // Initialize services
    voiceTracker = new VoiceTracker(client);
    reminderService = new ReminderService(client);
    schedulerService = new SchedulerService(client);
    audioMonitor = new AudioMonitor(client);
    youtubeMonitor = new YouTubeMonitor(client);

    const port = parseInt(PORT, 10);
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`Dashboard running on port ${port}`);
      console.log(`Health check available at: http://0.0.0.0:${port}/health`);
    });

    await registerCommands();

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('Missing DISCORD_BOT_TOKEN');
    }

    await client.login(token);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('Shutting down...');
  reminderService?.stop();
  youtubeMonitor?.stop();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  reminderService?.stop();
  youtubeMonitor?.stop();
  client.destroy();
  process.exit(0);
});

main();