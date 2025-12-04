import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { Session, Staff, Adjustment, GuildConfig } from '../models';
import { getCurrentDate, formatDuration, hoursToMinutes, calculateSessionDuration } from '../utils/time';

export const checkCommand = {
  data: new SlashCommandBuilder()
    .setName('check')
    .setDescription('Check VC time for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check (leave empty for yourself)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('date')
        .setDescription('Date to check (YYYY-MM-DD, leave empty for today)')
        .setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const dateOption = interaction.options.getString('date');
      const guildId = interaction.guildId!;
      const guild = interaction.guild;

      if (guild) {
        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (member?.voice.channel) {
          const existingSession = await Session.findOne({
            odcordId: targetUser.id,
            guildId,
            isActive: true
          });
          
          if (!existingSession) {
            const config = await GuildConfig.findOne({ guildId }) || { timezone: 'Asia/Kolkata' };
            const currentDate = getCurrentDate(config.timezone);
            
            const session = new Session({
              odcordId: targetUser.id,
              odcordUsername: targetUser.username,
              guildId,
              channelId: member.voice.channel.id,
              channelName: member.voice.channel.name,
              joinTime: new Date(),
              leaveTime: null,
              duration: 0,
              isAfk: false,
              date: currentDate,
              isActive: true,
              isSpeaking: false,
              speakingTime: 0
            });
            await session.save();
            console.log(`Created session for ${targetUser.username} in ${member.voice.channel.name} (via command)`);
          }
        }
      }

      const config = await GuildConfig.findOne({ guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';
      const date = dateOption || getCurrentDate(timezone);

      if (dateOption) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
          await interaction.editReply({ content: 'Invalid date format. Use YYYY-MM-DD.' });
          return;
        }
      }

      const sessions = await Session.find({
        odcordId: targetUser.id,
        guildId,
        date
      });

      let totalMinutes = sessions.reduce((sum, s) => {
        if (s.isActive) {
          return sum + calculateSessionDuration(s.joinTime, new Date());
        }
        return sum + s.duration;
      }, 0);

      const adjustments = await Adjustment.find({ odcordId: targetUser.id, guildId, date });
      let adjustmentTotal = 0;
      for (const adj of adjustments) {
        if (adj.type === 'add') {
          adjustmentTotal += adj.minutes;
        } else {
          adjustmentTotal -= adj.minutes;
        }
      }

      const finalMinutes = Math.max(0, totalMinutes + adjustmentTotal);

      const staff = await Staff.findOne({ odcordId: targetUser.id, guildId, isActive: true });
      const isStaff = !!staff;

      const activeSession = sessions.find(s => s.isActive);
      const currentStatus = activeSession ? `In VC: ${activeSession.channelName}` : 'Not in VC';

      const sessionLines: string[] = [];
      for (const session of sessions.slice(-10)) {
        const joinTime = session.joinTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const leaveTime = session.isActive ? 'Now' : session.leaveTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || 'Unknown';
        const duration = session.isActive ? calculateSessionDuration(session.joinTime, new Date()) : session.duration;
        sessionLines.push(`[${joinTime} - ${leaveTime}] ${session.channelName} - ${formatDuration(duration)}`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`VC Time: ${targetUser.username}`)
        .setColor(0x5865F2)
        .addFields(
          { name: 'Date', value: date, inline: true },
          { name: 'Total Time', value: formatDuration(finalMinutes), inline: true },
          { name: 'Status', value: currentStatus, inline: true },
          { name: 'Role', value: isStaff ? `Staff (${staff.requiredHours}h required)` : 'User', inline: true }
        )
        .setTimestamp();

      if (isStaff) {
        const requiredMinutes = hoursToMinutes(staff.requiredHours);
        const isExcused = staff.excuses.some(e => e.date === date);
        const progressPercent = Math.min(100, Math.round((finalMinutes / requiredMinutes) * 100));
        const remainingMinutes = Math.max(0, requiredMinutes - finalMinutes);
        
        let statusText = '';
        if (isExcused) {
          statusText = 'Excused';
        } else if (remainingMinutes > 0) {
          statusText = `${remainingMinutes} min remaining`;
        } else {
          statusText = 'Requirement met';
        }

        embed.addFields({
          name: 'Progress',
          value: `${progressPercent}% | ${Math.round(finalMinutes)}/${requiredMinutes} min (${formatDuration(finalMinutes)}/${staff.requiredHours}h)\n${statusText}`,
          inline: false
        });
      }

      if (adjustmentTotal !== 0) {
        embed.addFields({
          name: 'Adjustments',
          value: `${adjustmentTotal > 0 ? '+' : ''}${adjustmentTotal} minutes`,
          inline: true
        });
      }

      if (sessionLines.length > 0) {
        embed.addFields({
          name: `Sessions (${sessions.length} total)`,
          value: sessionLines.join('\n') || 'No sessions',
          inline: false
        });
      } else {
        embed.addFields({
          name: 'Sessions',
          value: 'No VC activity for this date',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Check command error:', error);
      await interaction.editReply({ content: 'An error occurred while checking VC time.' });
    }
  }
};
