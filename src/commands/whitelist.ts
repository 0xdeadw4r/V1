
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { FileWhitelist } from '../models';
import { isBotOwner } from '../config/owner';

export const whitelistCommand = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage file upload whitelist (Owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a user to the file whitelist')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to whitelist')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from the file whitelist')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to remove from whitelist')
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all whitelisted users')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    
    // Check if user is guild owner or bot owner
    const isGuildOwner = interaction.user.id === guild.ownerId;
    const isBotOwnerUser = isBotOwner(interaction.user.id);
    
    if (!isGuildOwner && !isBotOwnerUser) {
      await interaction.editReply({ 
        content: '❌ Only the server owner can manage the file whitelist.' 
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'add':
          await handleAdd(interaction, guildId);
          break;
        case 'remove':
          await handleRemove(interaction, guildId);
          break;
        case 'list':
          await handleList(interaction, guildId);
          break;
      }
    } catch (error) {
      console.error('Whitelist command error:', error);
      await interaction.editReply({ 
        content: '❌ An error occurred while managing the whitelist.' 
      });
    }
  }
};

async function handleAdd(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const existing = await FileWhitelist.findOne({ guildId, userId: user.id });
  if (existing) {
    await interaction.editReply({ 
      content: `❌ ${user.username} is already whitelisted.` 
    });
    return;
  }

  await FileWhitelist.create({
    guildId,
    userId: user.id,
    addedBy: interaction.user.id
  });

  await interaction.editReply({ 
    content: `✅ ${user.username} has been added to the file whitelist. They can now upload .zip and .rar files.` 
  });
}

async function handleRemove(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const user = interaction.options.getUser('user', true);

  const result = await FileWhitelist.deleteOne({ guildId, userId: user.id });

  if (result.deletedCount === 0) {
    await interaction.editReply({ 
      content: `❌ ${user.username} is not whitelisted.` 
    });
    return;
  }

  await interaction.editReply({ 
    content: `✅ ${user.username} has been removed from the file whitelist.` 
  });
}

async function handleList(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const whitelisted = await FileWhitelist.find({ guildId });

  if (whitelisted.length === 0) {
    await interaction.editReply({ 
      content: '📋 No users are currently whitelisted for file uploads.' 
    });
    return;
  }

  const userList = whitelisted.map((entry, index) => 
    `${index + 1}. <@${entry.userId}> (Added: ${entry.addedAt.toLocaleDateString()})`
  ).join('\n');

  await interaction.editReply({ 
    content: `📋 **Whitelisted Users (${whitelisted.length})**\n\n${userList}` 
  });
}
