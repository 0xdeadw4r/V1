import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { Adjustment, GuildConfig } from '../models';
import { getCurrentDate, formatDuration } from '../utils/time';

export const fixCommand = {
  data: new SlashCommandBuilder()
    .setName('fix')
    .setDescription('Adjust a user\'s VC time')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add time to a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('minutes')
            .setDescription('Minutes to add')
            .setRequired(true)
            .setMinValue(1))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for adjustment')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('date')
            .setDescription('Date (YYYY-MM-DD, defaults to today)')
            .setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove time from a user')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('minutes')
            .setDescription('Minutes to remove')
            .setRequired(true)
            .setMinValue(1))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for adjustment')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('date')
            .setDescription('Date (YYYY-MM-DD, defaults to today)')
            .setRequired(false))
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    
    try {
      const subcommand = interaction.options.getSubcommand() as 'add' | 'remove';
      const guildId = interaction.guildId!;

      const user = interaction.options.getUser('user', true);
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason', true);
      const dateOption = interaction.options.getString('date');

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

      const adjustment = new Adjustment({
        odcordId: user.id,
        odcordUsername: user.username,
        guildId,
        date,
        minutes,
        type: subcommand,
        reason,
        adjustedBy: interaction.user.id
      });

      await adjustment.save();

      const actionWord = subcommand === 'add' ? 'Added' : 'Removed';
      await interaction.editReply({
        content: `${actionWord} ${formatDuration(minutes)} ${subcommand === 'add' ? 'to' : 'from'} ${user.username} for ${date}. Reason: ${reason}`,
      });
    } catch (error) {
      console.error('Fix command error:', error);
      await interaction.editReply({ content: 'An error occurred while adjusting time.' });
    }
  }
};
