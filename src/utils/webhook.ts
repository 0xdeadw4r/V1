import { Session, Staff, Adjustment, GuildConfig } from '../models';
import { getCurrentDate, formatDuration, minutesToHours } from './time';

interface StaffLogEntry {
  userId: string;
  username: string;
  requiredHours: number;
  completedHours: number;
  completedMinutes: number;
  requirementMet: boolean;
  isExcused: boolean;
  excuseReason?: string;
  sessions: {
    channelName: string;
    joinTime: string;
    leaveTime: string;
    duration: number;
    isAfk: boolean;
  }[];
  adjustments: {
    type: string;
    minutes: number;
    reason: string;
  }[];
}

interface UserLogEntry {
  odcordId: string;
  username: string;
  totalMinutes: number;
  totalHours: number;
  sessions: {
    channelName: string;
    joinTime: string;
    leaveTime: string;
    duration: number;
    isAfk: boolean;
  }[];
}

export async function sendDailyLogs(guildId: string, date: string): Promise<void> {
  const config = await GuildConfig.findOne({ guildId });
  if (!config) return;

  if (config.webhookStaff) {
    await sendStaffLog(guildId, date, config.webhookStaff);
  }

  if (config.webhookUsers) {
    await sendUsersLog(guildId, date, config.webhookUsers);
  }
}

async function sendStaffLog(guildId: string, date: string, webhookUrl: string): Promise<void> {
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

  const staffLogs: StaffLogEntry[] = [];

  for (const staff of staffMembers) {
    const userSessions = sessions.filter(s => s.odcordId === staff.odcordId && !s.isAfk);
    const userAdjustments = adjustments.filter(a => a.odcordId === staff.odcordId);
    
    let totalMinutes = userSessions.reduce((sum, s) => sum + s.duration, 0);
    
    for (const adj of userAdjustments) {
      if (adj.type === 'add') {
        totalMinutes += adj.minutes;
      } else {
        totalMinutes -= adj.minutes;
      }
    }
    totalMinutes = Math.max(0, totalMinutes);

    const excuse = staff.excuses.find(e => e.date === date);
    const requiredMinutes = staff.requiredHours * 60;

    staffLogs.push({
      userId: staff.odcordId,
      username: staff.odcordUsername,
      requiredHours: staff.requiredHours,
      completedHours: minutesToHours(totalMinutes),
      completedMinutes: totalMinutes,
      requirementMet: excuse ? true : totalMinutes >= requiredMinutes,
      isExcused: !!excuse,
      excuseReason: excuse?.reason,
      sessions: userSessions.map(s => ({
        channelName: s.channelName,
        joinTime: s.joinTime.toISOString(),
        leaveTime: s.leaveTime?.toISOString() || 'Active',
        duration: s.duration,
        isAfk: s.isAfk
      })),
      adjustments: userAdjustments.map(a => ({
        type: a.type,
        minutes: a.minutes,
        reason: a.reason
      }))
    });
  }

  const payload = {
    type: 'staff_daily_log',
    date,
    guildId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalStaff: staffLogs.length,
      requirementsMet: staffLogs.filter(s => s.requirementMet).length,
      excused: staffLogs.filter(s => s.isExcused).length
    },
    staff: staffLogs
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`Staff log sent for ${date}`);
  } catch (error) {
    console.error('Failed to send staff log:', error);
  }
}

async function sendUsersLog(guildId: string, date: string, webhookUrl: string): Promise<void> {
  const staffMembers = await Staff.find({ guildId, isActive: true });
  const staffIds = staffMembers.map(s => s.odcordId);
  
  const sessions = await Session.find({
    guildId,
    date,
    odcordId: { $nin: staffIds }
  });

  const userMap = new Map<string, UserLogEntry>();

  for (const session of sessions) {
    if (!userMap.has(session.odcordId)) {
      userMap.set(session.odcordId, {
        odcordId: session.odcordId,
        username: session.odcordUsername,
        totalMinutes: 0,
        totalHours: 0,
        sessions: []
      });
    }

    const user = userMap.get(session.odcordId)!;
    if (!session.isAfk) {
      user.totalMinutes += session.duration;
    }
    user.sessions.push({
      channelName: session.channelName,
      joinTime: session.joinTime.toISOString(),
      leaveTime: session.leaveTime?.toISOString() || 'Active',
      duration: session.duration,
      isAfk: session.isAfk
    });
  }

  const userLogs = Array.from(userMap.values()).map(u => ({
    ...u,
    totalHours: minutesToHours(u.totalMinutes)
  }));

  const payload = {
    type: 'users_daily_log',
    date,
    guildId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsers: userLogs.length,
      totalMinutes: userLogs.reduce((sum, u) => sum + u.totalMinutes, 0)
    },
    users: userLogs
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`Users log sent for ${date}`);
  } catch (error) {
    console.error('Failed to send users log:', error);
  }
}

export async function getTopVCUsers(guildId: string, period: 'week' | 'month'): Promise<{ odcordId: string; username: string; totalMinutes: number }[]> {
  const now = new Date();
  const startDate = new Date();
  
  if (period === 'week') {
    startDate.setDate(now.getDate() - 7);
  } else {
    startDate.setMonth(now.getMonth() - 1);
  }

  const sessions = await Session.aggregate([
    {
      $match: {
        guildId,
        joinTime: { $gte: startDate },
        isAfk: false
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

  return sessions.map(s => ({
    odcordId: s._id,
    username: s.username,
    totalMinutes: s.totalMinutes
  }));
}
