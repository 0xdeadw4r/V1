import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AttachmentBuilder,
  MessageFlags
} from 'discord.js';
import { Session, Staff, Adjustment, GuildConfig } from '../models';
import { getCurrentDate, formatDuration, minutesToHours } from '../utils/time';
import { format, subDays } from 'date-fns';

export const logsCommand = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Get VC logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('staff')
        .setDescription('Get staff logs')
        .addStringOption(option =>
          option.setName('date')
            .setDescription('Date (YYYY-MM-DD, defaults to yesterday)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('format')
            .setDescription('Output format')
            .setRequired(false)
            .addChoices(
              { name: 'JSON', value: 'json' },
              { name: 'CSV', value: 'csv' }
            ))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('users')
        .setDescription('Get users logs')
        .addStringOption(option =>
          option.setName('date')
            .setDescription('Date (YYYY-MM-DD, defaults to yesterday)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('format')
            .setDescription('Output format')
            .setRequired(false)
            .addChoices(
              { name: 'JSON', value: 'json' },
              { name: 'CSV', value: 'csv' }
            ))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('top')
        .setDescription('Get top VC users')
        .addStringOption(option =>
          option.setName('period')
            .setDescription('Time period')
            .setRequired(true)
            .addChoices(
              { name: 'Weekly', value: 'week' },
              { name: 'Monthly', value: 'month' }
            ))
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId!;

      switch (subcommand) {
        case 'staff':
          await handleStaffLogs(interaction, guildId);
          break;
        case 'users':
          await handleUsersLogs(interaction, guildId);
          break;
        case 'top':
          await handleTopUsers(interaction, guildId);
          break;
      }
    } catch (error) {
      console.error('Logs command error:', error);
      await interaction.editReply({ content: 'An error occurred while fetching logs.' });
    }
  }
};

async function handleStaffLogs(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const config = await GuildConfig.findOne({ guildId });
  const timezone = config?.timezone || 'Asia/Kolkata';
  
  const dateOption = interaction.options.getString('date');
  const date = dateOption || format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const outputFormat = interaction.options.getString('format') || 'json';

  const staffMembers = await Staff.find({ guildId, isActive: true });
  const staffIds = staffMembers.map(s => s.odcordId);

  const sessions = await Session.find({
    guildId,
    date,
    odcordId: { $in: staffIds }
  });

  const adjustments = await Adjustment.find({
    guildId,
    date,
    odcordId: { $in: staffIds }
  });

  const staffData = staffMembers.map(staff => {
    const userSessions = sessions.filter(s => s.odcordId === staff.odcordId);
    const userAdjustments = adjustments.filter(a => a.odcordId === staff.odcordId);
    
    let totalMinutes = userSessions.reduce((sum, s) => sum + s.duration, 0);
    for (const adj of userAdjustments) {
      totalMinutes += adj.type === 'add' ? adj.minutes : -adj.minutes;
    }
    totalMinutes = Math.max(0, totalMinutes);

    const excuse = staff.excuses.find(e => e.date === date);

    return {
      odcordId: staff.odcordId,
      username: staff.odcordUsername,
      requiredHours: staff.requiredHours,
      completedMinutes: totalMinutes,
      completedHours: minutesToHours(totalMinutes),
      requirementMet: excuse ? true : totalMinutes >= staff.requiredHours * 60,
      isExcused: !!excuse,
      excuseReason: excuse?.reason || null,
      sessionCount: userSessions.length
    };
  });

  let content: string;
  let filename: string;

  if (outputFormat === 'csv') {
    const headers = 'Username,Required Hours,Completed Hours,Completed Minutes,Requirement Met,Is Excused,Excuse Reason,Sessions';
    const rows = staffData.map(s => 
      `"${s.username}",${s.requiredHours},${s.completedHours},${s.completedMinutes},${s.requirementMet},${s.isExcused},"${s.excuseReason || ''}",${s.sessionCount}`
    );
    content = [headers, ...rows].join('\n');
    filename = `staff_log_${date}.csv`;
  } else {
    content = JSON.stringify({
      type: 'staff_daily_log',
      date,
      guildId,
      generatedAt: new Date().toISOString(),
      staff: staffData
    }, null, 2);
    filename = `staff_log_${date}.json`;
  }

  const attachment = new AttachmentBuilder(Buffer.from(content), { name: filename });
  await interaction.editReply({ content: `Staff logs for ${date}`, files: [attachment] });
}

async function handleUsersLogs(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const config = await GuildConfig.findOne({ guildId });
  const timezone = config?.timezone || 'Asia/Kolkata';
  
  const dateOption = interaction.options.getString('date');
  const date = dateOption || format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const outputFormat = interaction.options.getString('format') || 'json';

  const staffMembers = await Staff.find({ guildId, isActive: true });
  const staffIds = staffMembers.map(s => s.odcordId);

  const sessions = await Session.find({
    guildId,
    date,
    odcordId: { $nin: staffIds }
  });

  const userMap = new Map<string, { username: string; totalMinutes: number; sessions: number }>();

  for (const session of sessions) {
    if (!userMap.has(session.odcordId)) {
      userMap.set(session.odcordId, {
        username: session.odcordUsername,
        totalMinutes: 0,
        sessions: 0
      });
    }
    
    const user = userMap.get(session.odcordId)!;
    user.totalMinutes += session.duration;
    user.sessions++;
  }

  const userData = Array.from(userMap.entries()).map(([odcordId, data]) => ({
    odcordId,
    username: data.username,
    totalMinutes: data.totalMinutes,
    totalHours: minutesToHours(data.totalMinutes),
    sessionCount: data.sessions
  }));

  let content: string;
  let filename: string;

  if (outputFormat === 'csv') {
    const headers = 'Username,Total Hours,Total Minutes,Sessions';
    const rows = userData.map(u => 
      `"${u.username}",${u.totalHours},${u.totalMinutes},${u.sessionCount}`
    );
    content = [headers, ...rows].join('\n');
    filename = `users_log_${date}.csv`;
  } else {
    content = JSON.stringify({
      type: 'users_daily_log',
      date,
      guildId,
      generatedAt: new Date().toISOString(),
      users: userData
    }, null, 2);
    filename = `users_log_${date}.json`;
  }

  const attachment = new AttachmentBuilder(Buffer.from(content), { name: filename });
  await interaction.editReply({ content: `User logs for ${date}`, files: [attachment] });
}

async function handleTopUsers(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const period = interaction.options.getString('period', true) as 'week' | 'month';
  
  const startDate = new Date();
  if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  const sessions = await Session.aggregate([
    {
      $match: {
        guildId,
        joinTime: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$odcordId',
        username: { $first: '$odcordUsername' },
        totalMinutes: { $sum: '$duration' }
      }
    },
    { $sort: { totalMinutes: -1 } },
    { $limit: 10 }
  ]);

  if (sessions.length === 0) {
    await interaction.editReply({ content: 'No VC activity found for this period.' });
    return;
  }

  const lines = sessions.map((s, i) => {
    const rank = `${i + 1}.`;
    return `${rank} ${s.username} - ${formatDuration(s.totalMinutes)}`;
  });

  const periodLabel = period === 'week' ? 'Weekly' : 'Monthly';

  await interaction.editReply({
    content: `**${periodLabel} Top VC Users**\n\n${lines.join('\n')}`
  });
}
