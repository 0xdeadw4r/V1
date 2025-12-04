
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { Session, GuildConfig } from '../models';
import { getCurrentDate, formatDuration } from '../utils/time';

export const statsCommand = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View detailed voice channel statistics')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check stats for (leave empty for server stats)')
        .setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    
    const guildId = interaction.guildId!;
    const user = interaction.options.getUser('user');

    try {
      const config = await GuildConfig.findOne({ guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';
      const currentDate = getCurrentDate(timezone);

      if (user) {
        // User stats
        await showUserStats(interaction, user.id, user.username, guildId, currentDate);
      } else {
        // Server stats
        await showServerStats(interaction, guildId, currentDate);
      }
    } catch (error) {
      console.error('Stats command error:', error);
      await interaction.editReply({ content: 'An error occurred while fetching stats.' });
    }
  }
};

async function showUserStats(
  interaction: ChatInputCommandInteraction,
  userId: string,
  username: string,
  guildId: string,
  currentDate: string
): Promise<void> {
  const allSessions = await Session.find({ odcordId: userId, guildId });
  const todaySessions = allSessions.filter(s => s.date === currentDate);

  if (allSessions.length === 0) {
    await interaction.editReply({ content: `${username} has no voice activity recorded.` });
    return;
  }

  // Calculate totals
  let totalMinutes = 0;
  let todayMinutes = 0;
  const channelCounts = new Map<string, number>();

  for (const session of allSessions) {
    const duration = session.isActive 
      ? Math.floor((new Date().getTime() - session.joinTime.getTime()) / 60000)
      : session.duration;

    totalMinutes += duration;

    if (session.date === currentDate) {
      todayMinutes += duration;
    }

    channelCounts.set(
      session.channelName,
      (channelCounts.get(session.channelName) || 0) + duration
    );
  }

  // Most used channel
  const mostUsedChannel = Array.from(channelCounts.entries())
    .sort((a, b) => b[1] - a[1])[0];

  const embed = new EmbedBuilder()
    .setTitle(`📊 Voice Stats for ${username}`)
    .setColor(0x5865F2)
    .addFields(
      { name: 'Today', value: formatDuration(todayMinutes), inline: true },
      { name: 'All Time', value: formatDuration(totalMinutes), inline: true },
      { name: 'Total Sessions', value: `${allSessions.length}`, inline: true },
      { name: 'Most Used Channel', value: `${mostUsedChannel[0]} (${formatDuration(mostUsedChannel[1])})`, inline: false }
    )
    .setTimestamp();

  const member = interaction.guild?.members.cache.get(userId);
  if (member?.voice?.channel) {
    embed.addFields({ name: 'Currently In', value: member.voice.channel.name, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function showServerStats(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  currentDate: string
): Promise<void> {
  const allSessions = await Session.find({ guildId });
  const todaySessions = allSessions.filter(s => s.date === currentDate);

  if (allSessions.length === 0) {
    await interaction.editReply({ content: 'No voice activity recorded for this server.' });
    return;
  }

  // Calculate stats
  const uniqueUsers = new Set(allSessions.map(s => s.odcordId)).size;
  const channelCounts = new Map<string, number>();

  let totalMinutes = 0;
  let todayMinutes = 0;

  for (const session of allSessions) {
    const duration = session.isActive 
      ? Math.floor((new Date().getTime() - session.joinTime.getTime()) / 60000)
      : session.duration;

    totalMinutes += duration;

    if (session.date === currentDate) {
      todayMinutes += duration;
    }

    channelCounts.set(
      session.channelName,
      (channelCounts.get(session.channelName) || 0) + 1
    );
  }

  // Most active channel
  const mostActiveChannel = Array.from(channelCounts.entries())
    .sort((a, b) => b[1] - a[1])[0];

  const embed = new EmbedBuilder()
    .setTitle(`📊 Server Voice Statistics`)
    .setColor(0x5865F2)
    .addFields(
      { name: 'Total Voice Time (Today)', value: formatDuration(todayMinutes), inline: true },
      { name: 'Total Voice Time (All Time)', value: formatDuration(totalMinutes), inline: true },
      { name: 'Unique Users Tracked', value: `${uniqueUsers}`, inline: true },
      { name: 'Total Sessions', value: `${allSessions.length}`, inline: true },
      { name: 'Most Active Channel', value: `${mostActiveChannel[0]} (${mostActiveChannel[1]} joins)`, inline: false }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
