
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { Staff } from '../models';
import { GenzAuthService } from '../services/GenzAuthService';

export const genzauthCommand = {
  data: new SlashCommandBuilder()
    .setName('genzauth')
    .setDescription('Manual GenzAuth key management for testing')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('Manually pause a staff member\'s GenzAuth key')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The staff member')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('resume')
        .setDescription('Manually resume a staff member\'s GenzAuth key')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The staff member')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check GenzAuth key status for a staff member')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The staff member')
            .setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      switch (subcommand) {
        case 'pause':
          await handlePause(interaction, guildId);
          break;
        case 'resume':
          await handleResume(interaction, guildId);
          break;
        case 'status':
          await handleStatus(interaction, guildId);
          break;
      }
    } catch (error) {
      console.error('GenzAuth command error:', error);
      await interaction.editReply({ content: 'An error occurred while processing the command.' });
    }
  }
};

async function handlePause(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const staff = await Staff.findOne({ odcordId: user.id, guildId, isActive: true });
  if (!staff) {
    await interaction.editReply({ content: `${user.username} is not a staff member.` });
    return;
  }

  if (!staff.genzauthUsername) {
    await interaction.editReply({ content: `${user.username} does not have a GenzAuth username configured.` });
    return;
  }

  if (staff.genzauthKeyPaused) {
    await interaction.editReply({ content: `${user.username}'s key is already paused.` });
    return;
  }

  const paused = await GenzAuthService.pauseUser(guildId, staff.genzauthUsername);
  
  if (paused) {
    staff.genzauthKeyPaused = true;
    await staff.save();
    await interaction.editReply({ 
      content: `✅ Successfully paused GenzAuth key for ${user.username} (${staff.genzauthUsername})` 
    });
  } else {
    await interaction.editReply({ 
      content: `❌ Failed to pause GenzAuth key for ${user.username}. Check console for details.` 
    });
  }
}

async function handleResume(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const staff = await Staff.findOne({ odcordId: user.id, guildId, isActive: true });
  if (!staff) {
    await interaction.editReply({ content: `${user.username} is not a staff member.` });
    return;
  }

  if (!staff.genzauthUsername) {
    await interaction.editReply({ content: `${user.username} does not have a GenzAuth username configured.` });
    return;
  }

  if (!staff.genzauthKeyPaused) {
    await interaction.editReply({ content: `${user.username}'s key is already active.` });
    return;
  }

  const resumed = await GenzAuthService.resumeUser(guildId, staff.genzauthUsername);
  
  if (resumed) {
    staff.genzauthKeyPaused = false;
    await staff.save();
    await interaction.editReply({ 
      content: `✅ Successfully resumed GenzAuth key for ${user.username} (${staff.genzauthUsername})` 
    });
  } else {
    await interaction.editReply({ 
      content: `❌ Failed to resume GenzAuth key for ${user.username}. Check console for details.` 
    });
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const staff = await Staff.findOne({ odcordId: user.id, guildId, isActive: true });
  if (!staff) {
    await interaction.editReply({ content: `${user.username} is not a staff member.` });
    return;
  }

  if (!staff.genzauthUsername) {
    await interaction.editReply({ 
      content: `${user.username} does not have a GenzAuth username configured.` 
    });
    return;
  }

  const status = staff.genzauthKeyPaused ? '🔴 PAUSED' : '🟢 ACTIVE';
  await interaction.editReply({ 
    content: `**GenzAuth Status for ${user.username}**\n` +
             `Username: \`${staff.genzauthUsername}\`\n` +
             `Status: ${status}`
  });
}
