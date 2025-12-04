
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { Session, Adjustment, GuildConfig } from '../models';
import { getCurrentDate, calculateSessionDuration, formatDuration } from '../utils/time';

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View voice channel time leaderboard')
    .addStringOption(option =>
      option.setName('period')
        .setDescription('Time period')
        .setRequired(false)
        .addChoices(
          { name: 'Today', value: 'today' },
          { name: 'All Time', value: 'all' }
        )),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    
    const guildId = interaction.guildId!;
    const period = interaction.options.getString('period') || 'today';

    try {
      const config = await GuildConfig.findOne({ guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';
      const currentDate = getCurrentDate(timezone);

      let query: any = { guildId };
      if (period === 'today') {
        query.date = currentDate;
      }

      const sessions = await Session.find(query);

      // Calculate total time per user
      const userTimes = new Map<string, { username: string, minutes: number }>();

      for (const session of sessions) {
        let minutes = session.isActive 
          ? calculateSessionDuration(session.joinTime, new Date())
          : session.duration;

        const existing = userTimes.get(session.odcordId);
        if (existing) {
          existing.minutes += minutes;
        } else {
          userTimes.set(session.odcordId, {
            username: session.odcordUsername,
            minutes
          });
        }
      }

      // Add adjustments for today
      if (period === 'today') {
        const adjustments = await Adjustment.find({ guildId, date: currentDate });
        for (const adj of adjustments) {
          const existing = userTimes.get(adj.odcordId);
          if (existing) {
            if (adj.type === 'add') {
              existing.minutes += adj.minutes;
            } else {
              existing.minutes -= adj.minutes;
            }
            existing.minutes = Math.max(0, existing.minutes);
          }
        }
      }

      // Sort by time
      const sorted = Array.from(userTimes.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 10);

      if (sorted.length === 0) {
        await interaction.editReply({ content: 'No voice activity found.' });
        return;
      }

      const lines = sorted.map((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${user.username}** - ${formatDuration(user.minutes)} (${Math.round(user.minutes)} min)`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Voice Channel Leaderboard - ${period === 'today' ? 'Today' : 'All Time'}`)
        .setDescription(lines.join('\n'))
        .setColor(0x5865F2)
        .setFooter({ text: `${sorted.length} users tracked` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Leaderboard command error:', error);
      await interaction.editReply({ content: 'An error occurred while fetching the leaderboard.' });
    }
  }
};
