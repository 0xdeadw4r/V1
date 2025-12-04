import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { Staff, GuildConfig, Session, Adjustment } from '../models';
import { getCurrentDate, formatDuration, hoursToMinutes, calculateSessionDuration } from '../utils/time';

export const remindCommand = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Manually send a reminder to a staff member')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The staff member to remind')
        .setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const targetUser = interaction.options.getUser('user', true);
      const guildId = interaction.guildId!;

      const staff = await Staff.findOne({ 
        odcordId: targetUser.id, 
        guildId, 
        isActive: true 
      });

      if (!staff) {
        await interaction.editReply({ 
          content: `${targetUser.username} is not a staff member.`
        });
        return;
      }

      const config = await GuildConfig.findOne({ guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';
      const currentDate = getCurrentDate(timezone);

      const isExcused = staff.excuses.some(e => e.date === currentDate);
      if (isExcused) {
        await interaction.editReply({ 
          content: `${targetUser.username} is excused for today.`
        });
        return;
      }

      const sessions = await Session.find({
        odcordId: targetUser.id,
        guildId,
        date: currentDate
      });

      let totalMinutes = sessions.reduce((sum, s) => {
        if (s.isActive) {
          return sum + calculateSessionDuration(s.joinTime, new Date());
        }
        return sum + s.duration;
      }, 0);

      const adjustments = await Adjustment.find({ 
        odcordId: targetUser.id, 
        guildId, 
        date: currentDate 
      });
      
      for (const adj of adjustments) {
        if (adj.type === 'add') {
          totalMinutes += adj.minutes;
        } else {
          totalMinutes -= adj.minutes;
        }
      }
      totalMinutes = Math.max(0, totalMinutes);

      const requiredMinutes = hoursToMinutes(staff.requiredHours);

      if (totalMinutes >= requiredMinutes) {
        await interaction.editReply({ 
          content: `${targetUser.username} has already completed their required hours for today.`
        });
        return;
      }

      try {
        const user = await interaction.client.users.fetch(targetUser.id);
        const remainingMinutes = requiredMinutes - totalMinutes;
        const progressPercent = Math.min(100, Math.round((totalMinutes / requiredMinutes) * 100));

        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('VC Time Reminder (Manual)')
          .setDescription(`You still need ${formatDuration(remainingMinutes)} to meet your daily requirement.`)
          .addFields(
            {
              name: 'Progress',
              value: `${formatDuration(totalMinutes)} / ${formatDuration(requiredMinutes)} (${progressPercent}%)`,
              inline: true
            },
            {
              name: 'Required',
              value: `${staff.requiredHours} hours`,
              inline: true
            }
          )
          .setFooter({ text: 'Use /mytime to check your current progress' })
          .setTimestamp();

        await user.send({ embeds: [embed] });

        await interaction.editReply({ 
          content: `Reminder sent to ${targetUser.username}`
        });
      } catch (error: any) {
        if (error?.code === 50007) {
          await interaction.editReply({ 
            content: `Cannot send DM to ${targetUser.username} - they have DMs disabled.`
          });
        } else {
          await interaction.editReply({ 
            content: `Failed to send reminder to ${targetUser.username}.`
          });
          console.error('Error sending manual reminder:', error);
        }
      }
    } catch (error) {
      console.error('Remind command error:', error);
      await interaction.editReply({ content: 'An error occurred while sending the reminder.' });
    }
  }
};
