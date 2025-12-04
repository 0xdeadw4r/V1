import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { GuildConfig } from '../models';

export const setCommand = {
  data: new SlashCommandBuilder()
    .setName('set')
    .setDescription('Configure bot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('webhook-staff')
        .setDescription('Set the webhook URL for staff logs')
        .addStringOption(option =>
          option.setName('url')
            .setDescription('Webhook URL')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('webhook-users')
        .setDescription('Set the webhook URL for user logs')
        .addStringOption(option =>
          option.setName('url')
            .setDescription('Webhook URL')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('timezone')
        .setDescription('Set the timezone')
        .addStringOption(option =>
          option.setName('timezone')
            .setDescription('Timezone (e.g., Asia/Kolkata, America/New_York)')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Set the daily reset time')
        .addStringOption(option =>
          option.setName('time')
            .setDescription('Reset time in HH:MM format (24-hour)')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('talking-mode')
        .setDescription('Toggle active talking detection mode')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable active talking mode')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('genzauth-key')
        .setDescription('Set GenzAuth seller API key for automatic key management')
        .addStringOption(option =>
          option.setName('key')
            .setDescription('Your GenzAuth seller API key')
            .setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId!;

      let config = await GuildConfig.findOne({ guildId });
      if (!config) {
        config = new GuildConfig({ guildId });
      }

      switch (subcommand) {
        case 'webhook-staff': {
          const url = interaction.options.getString('url', true);
          if (!isValidWebhookUrl(url)) {
            await interaction.editReply({ content: 'Invalid webhook URL.' });
            return;
          }
          config.webhookStaff = url;
          await config.save();
          await interaction.editReply({ content: 'Staff webhook URL updated.' });
          break;
        }

        case 'webhook-users': {
          const url = interaction.options.getString('url', true);
          if (!isValidWebhookUrl(url)) {
            await interaction.editReply({ content: 'Invalid webhook URL.' });
            return;
          }
          config.webhookUsers = url;
          await config.save();
          await interaction.editReply({ content: 'Users webhook URL updated.' });
          break;
        }

        case 'timezone': {
          const timezone = interaction.options.getString('timezone', true);
          try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
          } catch {
            await interaction.editReply({ content: 'Invalid timezone. Use a valid IANA timezone like Asia/Kolkata.' });
            return;
          }
          config.timezone = timezone;
          await config.save();
          await interaction.editReply({ content: `Timezone set to ${timezone}.` });
          break;
        }

        case 'reset': {
          const time = interaction.options.getString('time', true);
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(time)) {
            await interaction.editReply({ content: 'Invalid time format. Use HH:MM (24-hour).' });
            return;
          }
          config.resetTime = time;
          await config.save();
          await interaction.editReply({ content: `Daily reset time set to ${time}.` });
          break;
        }
        case 'talking-mode':
          await handleTalkingMode(interaction, guildId);
          break;
        case 'genzauth-key':
          await handleGenzauthKey(interaction, guildId);
          break;
      }
    } catch (error) {
      console.error('Set command error:', error);
      await interaction.editReply({ content: 'An error occurred while processing the command.' });
    }
  }
};

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && 
           (parsed.hostname.includes('discord.com') || parsed.hostname.includes('discordapp.com'));
  } catch {
    return false;
  }
}

async function handleTalkingMode(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);

  let config = await GuildConfig.findOne({ guildId });
  if (!config) {
    config = new GuildConfig({ guildId });
  }

  config.activeTalkingMode = enabled;
  await config.save();

  await interaction.editReply({ 
    content: `Active talking mode ${enabled ? 'enabled' : 'disabled'}. ${enabled ? 'Only time spent actively talking will be counted.' : 'All time in VC will be counted.'}` 
  });
}

async function handleGenzauthKey(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const key = interaction.options.getString('key', true);

  let config = await GuildConfig.findOne({ guildId });
  if (!config) {
    config = new GuildConfig({ guildId });
  }

  config.genzauthSellerKey = key;
  await config.save();

  await interaction.editReply({ 
    content: `GenzAuth seller key configured successfully! Staff members with GenzAuth usernames will now have their keys automatically paused if they don\'t complete 3 hours/day.` 
  });
}