import { Client, VoiceState, GuildMember, VoiceChannel, StageChannel } from 'discord.js';
import { Session, GuildConfig, Staff } from '../models';
import { getCurrentDate, calculateSessionDuration, getMidnightSplitTime } from '../utils/time';
import { format } from 'date-fns';

export class VoiceTracker {
  private client: Client;
  private activeSessions: Map<string, string> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    await this.recoverActiveSessions();
    await this.scanCurrentVoiceChannels();
    this.setupVoiceStateListener();
    console.log('Voice tracker initialized');
  }

  private setupVoiceStateListener(): void {
    console.log('Setting up voice state listener...');
    
    // Log all registered event listeners
    const listenerCount = this.client.listenerCount('voiceStateUpdate');
    console.log(`Current voiceStateUpdate listeners: ${listenerCount}`);
    
    this.client.on('voiceStateUpdate', async (oldState, newState) => {
      const username = newState.member?.user?.username || oldState.member?.user?.username || 'unknown';
      const isBot = newState.member?.user?.bot || oldState.member?.user?.bot;
      
      console.log(`[VOICE EVENT] User: ${username} (Bot: ${isBot})`);
      console.log(`[VOICE EVENT] Old channel: ${oldState.channelId} -> New channel: ${newState.channelId}`);
      console.log(`[VOICE EVENT] Guild: ${newState.guild?.name || oldState.guild?.name || 'unknown'}`);
      
      try {
        await this.handleVoiceStateUpdate(oldState, newState);
      } catch (error) {
        console.error('Error handling voice state update:', error);
      }
    });
    
    console.log('Voice state listener setup complete');
    console.log(`Total voiceStateUpdate listeners: ${this.client.listenerCount('voiceStateUpdate')}`);
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;

    const config = await this.getOrCreateConfig(guildId);
    const currentDate = getCurrentDate(config.timezone);

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (!oldChannelId && newChannelId) {
      await this.handleJoin(member, newState, currentDate, config);
    } else if (oldChannelId && !newChannelId) {
      await this.handleLeave(member, oldState, currentDate, config);
    } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      await this.handleChannelSwitch(member, oldState, newState, currentDate, config);
    }
  }

  private async handleJoin(
    member: GuildMember,
    state: VoiceState,
    date: string,
    config: any
  ): Promise<void> {
    const sessionKey = `${member.id}-${state.guild.id}`;
    
    if (this.activeSessions.has(sessionKey)) {
      console.log(`Session already exists for ${member.user.username}, skipping`);
      return;
    }

    const session = new Session({
      odcordId: member.id,
      odcordUsername: member.user.username,
      guildId: state.guild.id,
      channelId: state.channelId!,
      channelName: state.channel?.name || 'Unknown',
      joinTime: new Date(),
      leaveTime: null,
      duration: 0,
      isAfk: false,
      date,
      isActive: true,
      isSpeaking: false,
      speakingTime: 0
    });

    await session.save();
    this.activeSessions.set(sessionKey, session._id.toString());
    console.log(`${member.user.username} joined ${state.channel?.name}`);
  }

  private async handleLeave(
    member: GuildMember,
    state: VoiceState,
    date: string,
    config: any
  ): Promise<void> {
    const sessionKey = `${member.id}-${state.guild.id}`;
    const sessionId = this.activeSessions.get(sessionKey);

    if (sessionId) {
      const session = await Session.findById(sessionId);
      if (session && session.isActive) {
        const leaveTime = new Date();
        session.leaveTime = leaveTime;
        session.duration = calculateSessionDuration(session.joinTime, leaveTime);
        session.isActive = false;
        await session.save();
        console.log(`${member.user.username} left after ${session.duration} minutes`);
      }
      this.activeSessions.delete(sessionKey);
    }
  }

  private async handleChannelSwitch(
    member: GuildMember,
    oldState: VoiceState,
    newState: VoiceState,
    date: string,
    config: any
  ): Promise<void> {
    await this.handleLeave(member, oldState, date, config);
    await this.handleJoin(member, newState, date, config);
  }

  private async getOrCreateConfig(guildId: string): Promise<any> {
    let config = await GuildConfig.findOne({ guildId });
    if (!config) {
      config = new GuildConfig({ guildId });
      await config.save();
    }

    const guild = this.client.guilds.cache.get(guildId);
    if (guild && guild.afkChannelId && !config.afkChannelId) {
      config.afkChannelId = guild.afkChannelId;
      await config.save();
    }

    return config;
  }

  async scanCurrentVoiceChannels(): Promise<void> {
    console.log('Scanning current voice channels...');
    
    try {
      const guilds = this.client.guilds.cache;
      console.log(`Found ${guilds.size} guilds in cache`);
      
      if (guilds.size === 0) {
        console.log('No guilds in cache, fetching...');
        await this.client.guilds.fetch();
        console.log(`After fetch: ${this.client.guilds.cache.size} guilds`);
      }
      
      for (const [guildId, guild] of this.client.guilds.cache) {
        try {
          console.log(`Scanning guild: ${guild.name} (${guildId})`);
          const config = await this.getOrCreateConfig(guildId);
          const currentDate = getCurrentDate(config.timezone);

          console.log('Fetching guild members...');
          // Fetch all members
          await guild.members.fetch();
          console.log(`Fetched ${guild.members.cache.size} members`);
          
          // Small delay to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log('Checking voice states...');
          let voiceCount = 0;
          for (const [memberId, member] of guild.members.cache) {
            if (member.user.bot) continue;
            
            if (member.voice.channel) {
              voiceCount++;
              console.log(`Found ${member.user.username} in voice channel: ${member.voice.channel.name}`);
            
            const sessionKey = `${memberId}-${guildId}`;
            
            if (this.activeSessions.has(sessionKey)) {
              console.log(`Session already tracked for ${member.user.username}`);
              continue;
            }

            const existingSession = await Session.findOne({
              odcordId: memberId,
              guildId,
              isActive: true
            });

            if (existingSession) {
              this.activeSessions.set(sessionKey, existingSession._id.toString());
              console.log(`Found existing session for ${member.user.username}`);
              continue;
            }

            const session = new Session({
              odcordId: memberId,
              odcordUsername: member.user.username,
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
            this.activeSessions.set(sessionKey, session._id.toString());
            console.log(`Created session for ${member.user.username} in ${member.voice.channel.name}`);
          }
        }
        console.log(`Found ${voiceCount} users in voice channels for guild ${guild.name}`);
      } catch (error) {
        console.error(`Error scanning guild ${guildId}:`, error);
      }
    }

    console.log(`Voice channel scan complete. ${this.activeSessions.size} active sessions`);
    } catch (error) {
      console.error('Error in scanCurrentVoiceChannels:', error);
    }
  }

  async recoverActiveSessions(): Promise<void> {
    console.log('Recovering active sessions...');
    
    const activeSessions = await Session.find({ isActive: true });
    
    for (const session of activeSessions) {
      try {
        const guild = this.client.guilds.cache.get(session.guildId);
        if (!guild) {
          session.leaveTime = new Date();
          session.duration = calculateSessionDuration(session.joinTime, session.leaveTime);
          session.isActive = false;
          await session.save();
          continue;
        }

        const member = await guild.members.fetch(session.odcordId).catch(() => null);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
          session.leaveTime = new Date();
          session.duration = calculateSessionDuration(session.joinTime, session.leaveTime);
          session.isActive = false;
          await session.save();
          console.log(`Closed stale session for ${session.odcordUsername}`);
        } else if (voiceChannel.id !== session.channelId) {
          session.leaveTime = new Date();
          session.duration = calculateSessionDuration(session.joinTime, session.leaveTime);
          session.isActive = false;
          await session.save();

          const config = await this.getOrCreateConfig(session.guildId);
          const currentDate = getCurrentDate(config.timezone);
          
          const channelName = voiceChannel.name || 'Unknown Channel';

          const newSession = new Session({
            odcordId: session.odcordId,
            odcordUsername: session.odcordUsername,
            guildId: session.guildId,
            channelId: voiceChannel.id,
            channelName,
            joinTime: new Date(),
            leaveTime: null,
            duration: 0,
            isAfk: false,
            date: currentDate,
            isActive: true,
            isSpeaking: false,
            speakingTime: 0
          });
          await newSession.save();
          this.activeSessions.set(`${session.odcordId}-${session.guildId}`, newSession._id.toString());
          console.log(`Recovered session for ${session.odcordUsername} in ${channelName}`);
        } else {
          this.activeSessions.set(`${session.odcordId}-${session.guildId}`, session._id.toString());
          console.log(`Restored active session for ${session.odcordUsername}`);
        }
      } catch (error) {
        console.error(`Error recovering session for ${session.odcordUsername}:`, error);
        try {
          session.leaveTime = new Date();
          session.duration = calculateSessionDuration(session.joinTime, session.leaveTime);
          session.isActive = false;
          await session.save();
        } catch (saveError) {
          console.error(`Failed to close broken session:`, saveError);
        }
      }
    }

    console.log(`Session recovery complete. ${this.activeSessions.size} active sessions`);
  }

  async splitMidnightSessions(guildId: string, timezone: string): Promise<void> {
    const currentDate = getCurrentDate(timezone);
    const activeSessions = await Session.find({ guildId, isActive: true });

    for (const session of activeSessions) {
      if (session.date !== currentDate) {
        const midnightTime = getMidnightSplitTime(session.date, timezone);
        
        session.leaveTime = midnightTime;
        session.duration = calculateSessionDuration(session.joinTime, midnightTime);
        session.isActive = false;
        await session.save();

        const newSession = new Session({
          odcordId: session.odcordId,
          odcordUsername: session.odcordUsername,
          guildId: session.guildId,
          channelId: session.channelId,
          channelName: session.channelName,
          joinTime: midnightTime,
          leaveTime: null,
          duration: 0,
          isAfk: false,
          date: currentDate,
          isActive: true,
          isSpeaking: false,
          speakingTime: 0
        });
        await newSession.save();
        
        this.activeSessions.set(`${session.odcordId}-${session.guildId}`, newSession._id.toString());
        console.log(`Split midnight session for ${session.odcordUsername}`);
      }
    }
  }

  async getUserTodayTime(odcordId: string, guildId: string): Promise<number> {
    const config = await GuildConfig.findOne({ guildId });
    const timezone = config?.timezone || 'Asia/Kolkata';
    const currentDate = getCurrentDate(timezone);

    const sessions = await Session.find({
      odcordId,
      guildId,
      date: currentDate
    });

    let totalMinutes = sessions.reduce((sum, s) => {
      if (s.isActive) {
        return sum + calculateSessionDuration(s.joinTime, new Date());
      }
      return sum + s.duration;
    }, 0);

    return totalMinutes;
  }
}
