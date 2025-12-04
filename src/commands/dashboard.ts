
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Session, GuildConfig } from '../models';
import { getCurrentDate, formatDuration, calculateSessionDuration } from '../utils/time';

export const dashboardCommand = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('View live voice channel activity dashboard'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    try {
      const config = await GuildConfig.findOne({ guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';
      const currentDate = getCurrentDate(timezone);

      // Get all active sessions
      const activeSessions = await Session.find({
        guildId,
        isActive: true
      });

      if (activeSessions.length === 0) {
        await interaction.editReply({ content: '📊 No users currently in voice channels.' });
        return;
      }

      // Group by channel
      const channelMap = new Map<string, { name: string, users: any[] }>();

      for (const session of activeSessions) {
        const channel = guild.channels.cache.get(session.channelId);
        if (!channel) continue;

        const currentDuration = calculateSessionDuration(session.joinTime, new Date());
        
        if (!channelMap.has(session.channelId)) {
          channelMap.set(session.channelId, {
            name: session.channelName,
            users: []
          });
        }

        channelMap.get(session.channelId)!.users.push({
          username: session.odcordUsername,
          duration: currentDuration,
          joinTime: session.joinTime
        });
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle('🎙️ Live Voice Activity Dashboard')
        .setColor(0x5865F2)
        .setDescription(`**Total Active Users:** ${activeSessions.length}`)
        .setTimestamp();

      // Add fields for each channel
      for (const [channelId, data] of channelMap) {
        const userLines = data.users
          .sort((a, b) => b.duration - a.duration)
          .map(u => {
            const timeStr = formatDuration(u.duration);
            const joinedAt = u.joinTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
            return `• ${u.username} - ${timeStr} (joined ${joinedAt})`;
          });

        embed.addFields({
          name: `🔊 ${data.name} (${data.users.length} users)`,
          value: userLines.join('\n') || 'No users',
          inline: false
        });
      }

      // Get today's total stats
      const todaySessions = await Session.find({ guildId, date: currentDate });
      let todayTotal = todaySessions.reduce((sum, s) => {
        return sum + (s.isActive ? calculateSessionDuration(s.joinTime, new Date()) : s.duration);
      }, 0);

      embed.setFooter({ 
        text: `Today's Total: ${formatDuration(todayTotal)} | Updates every time you run this command` 
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Dashboard command error:', error);
      await interaction.editReply({ content: 'An error occurred while fetching the dashboard.' });
    }
  }
};
