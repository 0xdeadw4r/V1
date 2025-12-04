import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { Staff, GuildConfig, Session, Adjustment } from '../models';
import { getCurrentDate, formatDuration, hoursToMinutes, calculateSessionDuration } from '../utils/time';

export const staffCommand = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Manage staff members and their VC requirements')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a user as staff')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to add as staff')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('genzauth-username')
            .setDescription('GenzAuth username for automatic key management')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from staff')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to remove from staff')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('hours')
        .setDescription('Set required hours for a staff member')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The staff member')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('hours')
            .setDescription('Required hours per day')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(24))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check a staff member\'s status')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The staff member')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reminder')
        .setDescription('Set reminder interval in hours')
        .addIntegerOption(option =>
          option.setName('hours')
            .setDescription('Hours between reminders')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(24))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('excuse')
        .setDescription('Excuse a staff member for a day')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The staff member')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('date')
            .setDescription('Date (YYYY-MM-DD)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for excuse')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all staff members')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      switch (subcommand) {
        case 'add':
          await handleAdd(interaction, guildId);
          break;
        case 'remove':
          await handleRemove(interaction, guildId);
          break;
        case 'hours':
          await handleHours(interaction, guildId);
          break;
        case 'status':
          await handleStatus(interaction, guildId);
          break;
        case 'reminder':
          await handleReminder(interaction, guildId);
          break;
        case 'excuse':
          await handleExcuse(interaction, guildId);
          break;
        case 'list':
          await handleList(interaction, guildId);
          break;
      }
    } catch (error) {
      console.error('Staff command error:', error);
      await interaction.editReply({ content: 'An error occurred while processing the command.' });
    }
  }
};

async function handleAdd(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);
  const genzauthUsername = interaction.options.getString('genzauth-username');

  const existing = await Staff.findOne({ odcordId: user.id, guildId });
  if (existing) {
    if (existing.isActive) {
      await interaction.editReply({ content: `${user.username} is already a staff member.` });
      return;
    }
    existing.isActive = true;
    existing.odcordUsername = user.username;
    if (genzauthUsername) {
      existing.genzauthUsername = genzauthUsername;
      existing.genzauthKeyPaused = false;
    }
    await existing.save();
  } else {
    await Staff.create({
      odcordId: user.id,
      odcordUsername: user.username,
      guildId,
      requiredHours: 6,
      isActive: true,
      excuses: [],
      genzauthUsername: genzauthUsername || null,
      genzauthKeyPaused: false
    });
  }

  let message = `Added ${user.username} as staff with 6 hours/day requirement.`;
  if (genzauthUsername) {
    message += `\nGenzAuth username: ${genzauthUsername} (auto-pause enabled if <3hrs/day)`;
  }

  await interaction.editReply({ content: message });
}

async function handleRemove(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const staff = await Staff.findOne({ odcordId: user.id, guildId, isActive: true });
  if (!staff) {
    await interaction.editReply({ content: `${user.username} is not a staff member.` });
    return;
  }

  staff.isActive = false;
  await staff.save();

  await interaction.editReply({ content: `Removed ${user.username} from staff.` });
}

async function handleHours(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);
  const hours = interaction.options.getInteger('hours', true);

  const staff = await Staff.findOne({ odcordId: user.id, guildId, isActive: true });
  if (!staff) {
    await interaction.editReply({ content: `${user.username} is not a staff member.` });
    return;
  }

  staff.requiredHours = hours;
  await staff.save();

  await interaction.editReply({ content: `Set ${user.username}'s required hours to ${hours} hours/day.` });
}

async function handleStatus(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const staff = await Staff.findOne({ odcordId: user.id, guildId, isActive: true });
  if (!staff) {
    await interaction.editReply({ content: `${user.username} is not a staff member.` });
    return;
  }

  const config = await GuildConfig.findOne({ guildId });
  const timezone = config?.timezone || 'Asia/Kolkata';
  const currentDate = getCurrentDate(timezone);

  const sessions = await Session.find({
    odcordId: user.id,
    guildId,
    date: currentDate
  });

  let totalMinutes = sessions.reduce((sum, s) => {
    if (s.isActive) {
      return sum + calculateSessionDuration(s.joinTime, new Date());
    }
    return sum + s.duration;
  }, 0);

  const adjustments = await Adjustment.find({ odcordId: user.id, guildId, date: currentDate });
  for (const adj of adjustments) {
    if (adj.type === 'add') {
      totalMinutes += adj.minutes;
    } else {
      totalMinutes -= adj.minutes;
    }
  }
  totalMinutes = Math.max(0, totalMinutes);

  const requiredMinutes = hoursToMinutes(staff.requiredHours);
  const isExcused = staff.excuses.some(e => e.date === currentDate);
  const progressPercent = Math.min(100, Math.round((totalMinutes / requiredMinutes) * 100));
  const remainingMinutes = Math.max(0, requiredMinutes - totalMinutes);

  let currentStatus = 'Not in VC';
  const member = interaction.guild?.members.cache.get(user.id);
  if (member?.voice?.channel) {
    currentStatus = `In VC: ${member.voice.channel.name}`;
  }

  let statusText = '';
  if (isExcused) {
    statusText = 'Excused';
  } else if (remainingMinutes > 0) {
    statusText = `${remainingMinutes} min remaining`;
  } else {
    statusText = 'Requirement met';
  }

  const embed = new EmbedBuilder()
    .setTitle(`Staff Status: ${user.username}`)
    .setColor(isExcused ? 0x5865F2 : progressPercent >= 100 ? 0x57F287 : progressPercent >= 50 ? 0xFEE75C : 0xED4245)
    .addFields(
      { name: 'Current Status', value: currentStatus, inline: false },
      { name: 'Required Hours', value: `${staff.requiredHours}h (${requiredMinutes} min)`, inline: true },
      { name: 'Current Progress', value: isExcused ? 'Excused' : `${progressPercent}%`, inline: true },
      { name: 'Time Logged Today', value: `${formatDuration(totalMinutes)} (${Math.round(totalMinutes)} min)`, inline: true },
      { name: 'Status', value: statusText, inline: false }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleReminder(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const hours = interaction.options.getInteger('hours', true);

  let config = await GuildConfig.findOne({ guildId });
  if (!config) {
    config = new GuildConfig({ guildId });
  }

  config.reminderIntervalHours = hours;
  await config.save();

  await interaction.editReply({ content: `Set reminder interval to ${hours} hours.` });
}

async function handleExcuse(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);
  const date = interaction.options.getString('date', true);
  const reason = interaction.options.getString('reason', true);

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    await interaction.editReply({ content: 'Invalid date format. Use YYYY-MM-DD.' });
    return;
  }

  const staff = await Staff.findOne({ odcordId: user.id, guildId, isActive: true });
  if (!staff) {
    await interaction.editReply({ content: `${user.username} is not a staff member.` });
    return;
  }

  const existingExcuse = staff.excuses.find(e => e.date === date);
  if (existingExcuse) {
    await interaction.editReply({ content: `${user.username} is already excused for ${date}.` });
    return;
  }

  staff.excuses.push({ date, reason, createdAt: new Date() });
  await staff.save();

  await interaction.editReply({ content: `Excused ${user.username} for ${date}. Reason: ${reason}` });
}

async function handleList(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const staffMembers = await Staff.find({ guildId, isActive: true });

  if (staffMembers.length === 0) {
    await interaction.editReply({ content: 'No staff members configured.' });
    return;
  }

  const config = await GuildConfig.findOne({ guildId });
  const timezone = config?.timezone || 'Asia/Kolkata';
  const currentDate = getCurrentDate(timezone);

  const lines: string[] = [];
  for (const staff of staffMembers) {
    const sessions = await Session.find({
      odcordId: staff.odcordId,
      guildId,
      date: currentDate
    });

    let totalMinutes = sessions.reduce((sum, s) => {
      if (s.isActive) {
        return sum + calculateSessionDuration(s.joinTime, new Date());
      }
      return sum + s.duration;
    }, 0);

    const requiredMinutes = hoursToMinutes(staff.requiredHours);
    const isExcused = staff.excuses.some(e => e.date === currentDate);
    
    let status = '';
    if (isExcused) {
      status = '[EXCUSED]';
    } else if (totalMinutes >= requiredMinutes) {
      status = '[DONE]';
    } else {
      status = '[PENDING]';
    }

    lines.push(`${status} ${staff.odcordUsername} - ${formatDuration(totalMinutes)}/${staff.requiredHours}h (${Math.round(totalMinutes)} min)`);
  }

  const embed = new EmbedBuilder()
    .setTitle('Staff Members')
    .setDescription(lines.join('\n'))
    .setColor(0x5865F2)
    .setFooter({ text: `${staffMembers.length} staff members` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
