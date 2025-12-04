import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { Session, Staff, Adjustment, GuildConfig } from '../models';
import { getCurrentDate, formatDuration, hoursToMinutes, calculateSessionDuration } from '../utils/time';
import { isBotOwner } from '../config/owner';

export const mytimeCommand = {
  data: new SlashCommandBuilder()
    .setName('mytime')
    .setDescription('Check your own VC time for today (Staff only)'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      let staffData = await Staff.findOne({ odcordId: userId, guildId, isActive: true });
      
      // Bot owner can bypass staff check
      if (!staffData && !isBotOwner(userId)) {
        await interaction.editReply({ 
          content: 'This command is for staff members only. Use /check to view your VC time.'
        });
        return;
      }
      
      // Use found staff or create a temporary object for bot owner
      const staff = staffData || { requiredHours: 0, excuses: [] as { date: string }[] };

      const config = await GuildConfig.findOne({ guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';
      const currentDate = getCurrentDate(timezone);

      const sessions = await Session.find({
        odcordId: userId,
        guildId,
        date: currentDate
      });

      let totalMinutes = sessions.reduce((sum, s) => {
        if (s.isActive) {
          return sum + calculateSessionDuration(s.joinTime, new Date());
        }
        return sum + s.duration;
      }, 0);

      const adjustments = await Adjustment.find({ odcordId: userId, guildId, date: currentDate });
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

      const activeSession = sessions.find(s => s.isActive);
      const currentStatus = activeSession ? `In VC: ${activeSession.channelName}` : 'Not in VC';

      let statusText = '';
      if (isExcused) {
        statusText = 'Excused for today';
      } else if (remainingMinutes > 0) {
        statusText = `${remainingMinutes} min remaining to meet goal`;
      } else {
        statusText = 'Daily requirement met';
      }

      const progressBar = generateProgressBar(progressPercent);

      const embed = new EmbedBuilder()
        .setTitle(`Your VC Time Today`)
        .setColor(isExcused ? 0x5865F2 : progressPercent >= 100 ? 0x57F287 : progressPercent >= 50 ? 0xFEE75C : 0xED4245)
        .addFields(
          { name: 'Current Status', value: currentStatus, inline: false },
          { name: 'Time Logged', value: `${formatDuration(totalMinutes)} (${Math.round(totalMinutes)} min)`, inline: true },
          { name: 'Required', value: `${staff.requiredHours}h (${requiredMinutes} min)`, inline: true },
          { name: 'Progress', value: `${progressBar} ${progressPercent}%`, inline: false },
          { name: 'Status', value: statusText, inline: false }
        )
        .setFooter({ text: `Date: ${currentDate} | Timezone: ${timezone}` })
        .setTimestamp();

      if (sessions.length > 0) {
        const sessionLines: string[] = [];
        for (const session of sessions.slice(-5)) {
          const joinTime = session.joinTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const leaveTime = session.isActive ? 'Now' : session.leaveTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || 'Unknown';
          const duration = session.isActive ? calculateSessionDuration(session.joinTime, new Date()) : session.duration;
          sessionLines.push(`[${joinTime} - ${leaveTime}] ${session.channelName} - ${formatDuration(duration)}`);
        }
        embed.addFields({
          name: `Today's Sessions (${sessions.length})`,
          value: sessionLines.join('\n'),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Mytime command error:', error);
      await interaction.editReply({ content: 'An error occurred while checking your time.' });
    }
  }
};

function generateProgressBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '[' + '='.repeat(filled) + '-'.repeat(empty) + ']';
}
