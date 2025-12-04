
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { YouTubeConfig } from '../models';

export class YouTubeMonitor {
  private client: Client;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    console.log('Initializing YouTube monitor...');
    const configs = await YouTubeConfig.find({});
    
    for (const config of configs) {
      this.startMonitoring(config.guildId, config.youtubeChannelId, config.channelId, config.checkInterval);
    }
    
    console.log(`YouTube monitor initialized with ${configs.length} channels`);
  }

  startMonitoring(guildId: string, youtubeChannelId: string, discordChannelId: string, interval: number = 60000): void {
    const key = `${guildId}-${youtubeChannelId}`;
    
    if (this.intervals.has(key)) {
      clearInterval(this.intervals.get(key)!);
    }

    const checkForUpdates = async () => {
      try {
        await this.checkYouTubeChannel(guildId, youtubeChannelId, discordChannelId);
      } catch (error) {
        console.error(`Error checking YouTube channel ${youtubeChannelId}:`, error);
      }
    };

    checkForUpdates();
    const intervalId = setInterval(checkForUpdates, interval);
    this.intervals.set(key, intervalId);
    
    console.log(`Started monitoring YouTube channel ${youtubeChannelId} for guild ${guildId}`);
  }

  stopMonitoring(guildId: string, youtubeChannelId: string): void {
    const key = `${guildId}-${youtubeChannelId}`;
    const intervalId = this.intervals.get(key);
    
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(key);
      console.log(`Stopped monitoring YouTube channel ${youtubeChannelId} for guild ${guildId}`);
    }
  }

  private async checkYouTubeChannel(guildId: string, youtubeChannelId: string, discordChannelId: string): Promise<void> {
    const config = await YouTubeConfig.findOne({ guildId, youtubeChannelId });
    if (!config) return;

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(discordChannelId);
    if (!channel || !channel.isTextBased()) return;

    // Fetch latest videos from RSS feed
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${youtubeChannelId}`;
    
    try {
      const response = await fetch(rssUrl);
      const xmlText = await response.text();
      
      // Parse XML to get latest video
      const videoMatch = xmlText.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = xmlText.match(/<title>(.*?)<\/title>/g);
      
      if (!videoMatch) return;
      
      const latestVideoId = videoMatch[1];
      const videoTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/<\/?title>/g, '') : 'New Video';
      
      // Check if this is a new video
      if (config.lastVideoId !== latestVideoId) {
        const videoUrl = `https://www.youtube.com/watch?v=${latestVideoId}`;
        
        // Check if it's a livestream
        const isLive = xmlText.includes('live') || xmlText.includes('streaming');
        
        if (isLive && config.lastStreamId !== latestVideoId) {
          // New livestream
          const embed = new EmbedBuilder()
            .setTitle('🔴 LIVE NOW!')
            .setDescription(`**${videoTitle}**\n\n[Watch Now](${videoUrl})`)
            .setColor(0xFF0000)
            .setThumbnail(`https://i.ytimg.com/vi/${latestVideoId}/maxresdefault.jpg`)
            .setTimestamp();
          
          await (channel as TextChannel).send({ content: '@everyone', embeds: [embed] });
          
          config.lastStreamId = latestVideoId;
          config.lastVideoId = latestVideoId;
        } else if (!isLive) {
          // New video upload
          const embed = new EmbedBuilder()
            .setTitle('📹 New Video Uploaded!')
            .setDescription(`**${videoTitle}**\n\n[Watch Now](${videoUrl})`)
            .setColor(0xFF0000)
            .setThumbnail(`https://i.ytimg.com/vi/${latestVideoId}/maxresdefault.jpg`)
            .setTimestamp();
          
          await (channel as TextChannel).send({ embeds: [embed] });
          
          config.lastVideoId = latestVideoId;
        }
        
        await config.save();
      }
    } catch (error) {
      console.error(`Error fetching YouTube RSS for ${youtubeChannelId}:`, error);
    }
  }

  async addChannel(guildId: string, youtubeChannelId: string, discordChannelId: string): Promise<void> {
    await YouTubeConfig.create({
      guildId,
      channelId: discordChannelId,
      youtubeChannelId,
      checkInterval: 60000
    });
    
    this.startMonitoring(guildId, youtubeChannelId, discordChannelId);
  }

  async removeChannel(guildId: string, youtubeChannelId: string): Promise<void> {
    await YouTubeConfig.deleteOne({ guildId, youtubeChannelId });
    this.stopMonitoring(guildId, youtubeChannelId);
  }

  stop(): void {
    for (const intervalId of this.intervals.values()) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
    console.log('YouTube monitor stopped');
  }
}
