import { Router, Request, Response } from 'express';
import { Client } from 'discord.js';
import { Server as SocketServer } from 'socket.io';
import { validateCredentials, isAuthenticated } from './auth';
import { Staff, FileWhitelist, GuildConfig, Session, Adjustment } from '../models';
import { getCurrentDate, formatDuration, hoursToMinutes, calculateSessionDuration } from '../utils/time';

declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
  }
}

// Function to refresh all embeds in a guild with current discount status
export async function refreshAllEmbeds(client: Client, guildId: string): Promise<void> {
  try {
    const { CustomEmbed, Discount } = await import('../models');

    const now = new Date();

    // Get all embeds for this guild
    const embeds = await CustomEmbed.find({ guildId });

    for (const embedConfig of embeds) {
      if (!embedConfig.channelId) continue;

      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(embedConfig.channelId);
        if (!channel || !channel.isTextBased()) continue;

        // Get embed-specific discount or fall back to global active discount
        let activeDiscount = null;
        if (embedConfig.discountId) {
          activeDiscount = await Discount.findOne({
            _id: embedConfig.discountId,
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
          });
        }
        
        // If no embed-specific discount, check for global active discount
        if (!activeDiscount) {
          activeDiscount = await Discount.findOne({
            guildId,
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
          });
        }

        // Build the embed
        const { EmbedBuilder } = await import('discord.js');
        const embed = new EmbedBuilder()
          .setTitle(embedConfig.title)
          .setDescription(embedConfig.description)
          .setColor(embedConfig.color as any);

        if (embedConfig.fields && embedConfig.fields.length > 0) {
          embedConfig.fields.forEach(field => {
            embed.addFields({
              name: field.name,
              value: field.value,
              inline: field.inline || false
            });
          });
        }

        if (embedConfig.prices && embedConfig.prices.length > 0) {
          let priceText = '';

          if (activeDiscount) {
            priceText += `**${activeDiscount.discountPercentage}% OFF SALE!**\n\n`;
          }

          embedConfig.prices.forEach(priceItem => {
            const originalPrice = priceItem.price;
            let finalPrice = originalPrice;

            if (activeDiscount) {
              finalPrice = originalPrice - (originalPrice * activeDiscount.discountPercentage / 100);
              priceText += `▸ **${priceItem.name}** – ~~${priceItem.currency}${originalPrice}~~ **${priceItem.currency}${finalPrice.toFixed(0)}**\n`;
            } else {
              priceText += `▸ **${priceItem.name}** – ${priceItem.currency}${originalPrice}\n`;
            }
          });

          embed.addFields({
            name: 'Prices',
            value: priceText,
            inline: false
          });
        }

        if (embedConfig.imageUrl) embed.setImage(embedConfig.imageUrl);
        if (embedConfig.thumbnailUrl) embed.setThumbnail(embedConfig.thumbnailUrl);
        if (embedConfig.footerText) embed.setFooter({ text: embedConfig.footerText });
        embed.setTimestamp();

        // Edit existing message or send new one
        if (embedConfig.messageId) {
          try {
            const message = await channel.messages.fetch(embedConfig.messageId);
            await message.edit({ embeds: [embed] });
            console.log(`Updated existing embed "${embedConfig.title}" in guild ${guildId}`);
          } catch (fetchError) {
            // Message not found, send new one
            const newMessage = await channel.send({ embeds: [embed] });
            await CustomEmbed.findByIdAndUpdate(embedConfig._id, { messageId: newMessage.id });
            console.log(`Sent new embed "${embedConfig.title}" (old message not found) in guild ${guildId}`);
          }
        } else {
          // No message ID stored, send new one
          const newMessage = await channel.send({ embeds: [embed] });
          await CustomEmbed.findByIdAndUpdate(embedConfig._id, { messageId: newMessage.id });
          console.log(`Sent new embed "${embedConfig.title}" in guild ${guildId}`);
        }

      } catch (error) {
        console.error(`Failed to refresh embed ${embedConfig._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error refreshing embeds:', error);
  }
}

export function createDashboardRoutes(
  client: Client,
  getBotStartTime: () => Date | null,
  io: SocketServer
): Router {
  const router = Router();

  // Helper function to broadcast discount updates
  const broadcastDiscountUpdate = async (guildId: string) => {
    if (!io) return;
    try {
      const { Discount } = await import('../models');
      const discounts = await Discount.find({ guildId }).sort({ createdAt: -1 });
      io.emit('discountsUpdated', { guildId, discounts });
    } catch (error) {
      console.error('Error broadcasting discount update:', error);
    }
  };

  // Middleware to check authentication
  const requireAuth = (req: Request, res: Response, next: Function) => {
    console.log('Auth check:', {
      authenticated: req.session?.authenticated,
      sessionID: req.sessionID,
      session: req.session
    });

    if (!req.session || !req.session.authenticated) {
      console.log('Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  router.post('/api/login', (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (validateCredentials(username, password)) {
      req.session.authenticated = true;
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ error: 'Failed to save session' });
        }
        console.log('Login successful, session saved:', req.sessionID);
        res.json({ success: true });
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  router.post('/api/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to logout' });
      } else {
        res.json({ success: true });
      }
    });
  });

  router.get('/api/auth/check', (req: Request, res: Response) => {
    res.json({ authenticated: !!req.session.authenticated });
  });

  // Check session endpoint
  router.get('/api/dashboard/check-auth', (req, res) => {
    res.json({
      authenticated: !!(req.session as any)?.authenticated,
      sessionID: req.sessionID
    });
  });

  router.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const botStartTime = getBotStartTime();
      const uptime = botStartTime ? Math.floor((Date.now() - botStartTime.getTime()) / 1000) : 0;

      const guildList = client.guilds.cache.map(g => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount
      }));

      const stats = {
        isOnline: client.isReady(),
        ping: client.ws.ping,
        uptime,
        guilds: client.guilds.cache.size,
        users: client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
        botName: client.user?.tag || 'Bot',
        botAvatar: client.user?.displayAvatarURL(),
        guildList
      };

      console.log('Sending stats:', stats);
      res.json(stats);
    } catch (error) {
      console.error('Stats API error:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  router.get('/api/staff', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId } = req.query;
      const query = guildId ? { guildId } : {};
      const staffList = await Staff.find(query);

      const enrichedStaff = await Promise.all(staffList.map(async (staff) => {
        let username = staff.odcordId;
        try {
          const user = await client.users.fetch(staff.odcordId);
          username = user.username;
        } catch {}

        return {
          ...staff.toObject(),
          username
        };
      }));

      res.json(enrichedStaff);
    } catch (error) {
      console.error('Staff fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  });

  router.post('/api/staff', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { odcordId, guildId, requiredHours, genzauthUsername } = req.body;

      const existing = await Staff.findOne({ odcordId, guildId });
      if (existing) {
        return res.status(400).json({ error: 'Staff member already exists' });
      }

      let username = odcordId;
      try {
        const user = await client.users.fetch(odcordId);
        username = user.username;
      } catch {}

      const newStaff = await Staff.create({
        odcordId,
        odcordUsername: username,
        guildId,
        requiredHours: requiredHours || 2,
        isActive: true,
        excuses: [],
        genzauthUsername: genzauthUsername || null,
        genzauthKeyPaused: false
      });

      res.json(newStaff);
    } catch (error) {
      console.error('Staff create error:', error);
      res.status(500).json({ error: 'Failed to create staff' });
    }
  });

  router.put('/api/staff/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const staff = await Staff.findByIdAndUpdate(id, updates, { new: true });
      if (!staff) {
        return res.status(404).json({ error: 'Staff not found' });
      }

      res.json(staff);
    } catch (error) {
      console.error('Staff update error:', error);
      res.status(500).json({ error: 'Failed to update staff' });
    }
  });

  router.delete('/api/staff/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await Staff.findByIdAndDelete(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Staff delete error:', error);
      res.status(500).json({ error: 'Failed to delete staff' });
    }
  });

  router.get('/api/whitelist', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId } = req.query;
      const query = guildId ? { guildId } : {};
      const whitelist = await FileWhitelist.find(query);

      const enrichedWhitelist = await Promise.all(whitelist.map(async (entry) => {
        let username = entry.userId;
        try {
          const user = await client.users.fetch(entry.userId);
          username = user.username;
        } catch {}

        return {
          ...entry.toObject(),
          username
        };
      }));

      res.json(enrichedWhitelist);
    } catch (error) {
      console.error('Whitelist fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch whitelist' });
    }
  });

  router.post('/api/whitelist', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId, guildId } = req.body;

      const existing = await FileWhitelist.findOne({ userId, guildId });
      if (existing) {
        return res.status(400).json({ error: 'User already whitelisted' });
      }

      const newEntry = await FileWhitelist.create({
        userId,
        guildId,
        addedBy: 'dashboard'
      });

      res.json(newEntry);
    } catch (error) {
      console.error('Whitelist create error:', error);
      res.status(500).json({ error: 'Failed to whitelist user' });
    }
  });

  router.delete('/api/whitelist/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await FileWhitelist.findByIdAndDelete(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Whitelist delete error:', error);
      res.status(500).json({ error: 'Failed to remove from whitelist' });
    }
  });

  router.get('/api/guild-config', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const guildId = req.query.guildId as string;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId required' });
      }

      let config = await GuildConfig.findOne({ guildId });
      if (!config) {
        config = await GuildConfig.create({ guildId, timezone: 'Asia/Kolkata' });
      }

      res.json(config);
    } catch (error) {
      console.error('Guild config fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch config' });
    }
  });

  router.put('/api/guild-config', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId, timezone, logChannelId, webhookUrl, genzauthSellerKey } = req.body;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId required' });
      }

      const updates: any = {};
      if (timezone !== undefined) updates.timezone = timezone;
      if (logChannelId !== undefined) updates.logChannelId = logChannelId;
      if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;
      if (genzauthSellerKey !== undefined) updates.genzauthSellerKey = genzauthSellerKey;

      const config = await GuildConfig.findOneAndUpdate(
        { guildId },
        updates,
        { new: true, upsert: true }
      );

      res.json(config);
    } catch (error) {
      console.error('Guild config update error:', error);
      res.status(500).json({ error: 'Failed to update config' });
    }
  });

  router.get('/api/sessions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId, date, userId } = req.query;
      const query: any = {};

      if (guildId) query.guildId = guildId;
      if (date) query.date = date;
      if (userId) query.odcordId = userId;

      const sessions = await Session.find(query).sort({ joinTime: -1 }).limit(100);

      const enrichedSessions = await Promise.all(sessions.map(async (session) => {
        let username = session.odcordId;
        try {
          const user = await client.users.fetch(session.odcordId);
          username = user.username;
        } catch {}

        return {
          ...session.toObject(),
          username
        };
      }));

      res.json(enrichedSessions);
    } catch (error) {
      console.error('Sessions fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  router.get('/api/active-sessions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId } = req.query;
      const query: any = { isActive: true };
      if (guildId) query.guildId = guildId;

      const sessions = await Session.find(query);

      const enrichedSessions = await Promise.all(sessions.map(async (session) => {
        let username = session.odcordId;
        let avatar = null;
        try {
          const user = await client.users.fetch(session.odcordId);
          username = user.username;
          avatar = user.displayAvatarURL();
        } catch {}

        const duration = calculateSessionDuration(session.joinTime, new Date());

        return {
          ...session.toObject(),
          username,
          avatar,
          currentDuration: duration
        };
      }));

      res.json(enrichedSessions);
    } catch (error) {
      console.error('Active sessions fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch active sessions' });
    }
  });

  router.post('/api/adjustment', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { odcordId, guildId, type, minutes, reason } = req.body;

      const config = await GuildConfig.findOne({ guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';
      const date = getCurrentDate(timezone);

      const adjustment = await Adjustment.create({
        odcordId,
        guildId,
        date,
        type,
        minutes,
        reason,
        adjustedBy: 'dashboard'
      });

      res.json(adjustment);
    } catch (error) {
      console.error('Adjustment create error:', error);
      res.status(500).json({ error: 'Failed to create adjustment' });
    }
  });

  router.post('/api/genzauth/pause', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId, guildId } = req.body;

      const staff = await Staff.findOne({ odcordId: userId, guildId, isActive: true });
      if (!staff || !staff.genzauthUsername) {
        return res.status(404).json({ error: 'Staff not found or no GenzAuth username configured' });
      }

      const { GenzAuthService } = await import('../services/GenzAuthService');
      const paused = await GenzAuthService.pauseUser(guildId, staff.genzauthUsername);

      if (paused) {
        staff.genzauthKeyPaused = true;
        await staff.save();
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to pause GenzAuth key' });
      }
    } catch (error) {
      console.error('GenzAuth pause error:', error);
      res.status(500).json({ error: 'Failed to pause GenzAuth key' });
    }
  });

  router.post('/api/genzauth/resume', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId, guildId } = req.body;

      const staff = await Staff.findOne({ odcordId: userId, guildId, isActive: true });
      if (!staff || !staff.genzauthUsername) {
        return res.status(404).json({ error: 'Staff not found or no GenzAuth username configured' });
      }

      const { GenzAuthService } = await import('../services/GenzAuthService');
      const resumed = await GenzAuthService.resumeUser(guildId, staff.genzauthUsername);

      if (resumed) {
        staff.genzauthKeyPaused = false;
        await staff.save();
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to resume GenzAuth key' });
      }
    } catch (error) {
      console.error('GenzAuth resume error:', error);
      res.status(500).json({ error: 'Failed to resume GenzAuth key' });
    }
  });

  router.post('/api/genzauth/pause-username', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { username, guildId } = req.body;

      if (!username || !guildId) {
        return res.status(400).json({ error: 'Username and guildId are required' });
      }

      const { GenzAuthService } = await import('../services/GenzAuthService');
      const paused = await GenzAuthService.pauseUser(guildId, username);

      if (paused) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to pause user key' });
      }
    } catch (error) {
      console.error('Manual GenzAuth pause error:', error);
      res.status(500).json({ error: 'Failed to pause user key' });
    }
  });

  router.post('/api/genzauth/resume-username', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { username, guildId } = req.body;

      if (!username || !guildId) {
        return res.status(400).json({ error: 'Username and guildId are required' });
      }

      const { GenzAuthService } = await import('../services/GenzAuthService');
      const resumed = await GenzAuthService.resumeUser(guildId, username);

      if (resumed) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to resume user key' });
      }
    } catch (error) {
      console.error('Manual GenzAuth resume error:', error);
      res.status(500).json({ error: 'Failed to resume user key' });
    }
  });

  router.get('/api/discounts', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId } = req.query;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId required' });
      }

      const { Discount } = await import('../models');
      const discounts = await Discount.find({ guildId }).sort({ createdAt: -1 });
      res.json(discounts);
    } catch (error) {
      console.error('Discount fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch discounts' });
    }
  });

  router.post('/api/discounts', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId, discountPercentage, startDate, endDate, embedId } = req.body;

      const { Discount } = await import('../models');
      const config = await GuildConfig.findOne({ guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';

      // Parse dates in the guild's timezone
      const { fromZonedTime } = await import('date-fns-tz');

      // Set start date to beginning of day in guild timezone
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const startUTC = fromZonedTime(start, timezone);

      // Set end date to end of day in guild timezone
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endUTC = fromZonedTime(end, timezone);

      const discount = await Discount.create({
        guildId,
        discountPercentage,
        startDate: startUTC,
        endDate: endUTC,
        isActive: true,
        embedId: embedId || null
      });

      // Broadcast discount update
      await broadcastDiscountUpdate(guildId);
      // Refresh embeds for this guild
      await refreshAllEmbeds(client, guildId);

      res.json(discount);
    } catch (error) {
      console.error('Discount create error:', error);
      res.status(500).json({ error: 'Failed to create discount' });
    }
  });

  router.put('/api/discounts/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { discountPercentage, startDate, endDate, isActive, guildId } = req.body;
      const { Discount } = await import('../models');

      const discount = await Discount.findById(id);
      if (!discount) {
        return res.status(404).json({ error: 'Discount not found' });
      }

      const config = await GuildConfig.findOne({ guildId: guildId || discount.guildId });
      const timezone = config?.timezone || 'Asia/Kolkata';
      const { fromZonedTime } = await import('date-fns-tz');

      const updateData: any = {};
      if (discountPercentage !== undefined) updateData.discountPercentage = discountPercentage;
      if (startDate !== undefined) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        updateData.startDate = fromZonedTime(start, timezone);
      }
      if (endDate !== undefined) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        updateData.endDate = fromZonedTime(end, timezone);
      }
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedDiscount = await Discount.findByIdAndUpdate(id, updateData, { new: true });

      // Broadcast discount update
      if (updatedDiscount) {
        await broadcastDiscountUpdate(updatedDiscount.guildId);
        // Refresh embeds for this guild
        await refreshAllEmbeds(client, updatedDiscount.guildId);
      }

      res.json(updatedDiscount);
    } catch (error) {
      console.error('Discount update error:', error);
      res.status(500).json({ error: 'Failed to update discount' });
    }
  });

  router.post('/api/discounts/fix-dates', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { Discount } = await import('../models');
      const discounts = await Discount.find({});

      let fixed = 0;
      for (const discount of discounts) {
        const end = new Date(discount.endDate);
        // If end time is at midnight, fix it to end of day
        if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
          end.setHours(23, 59, 59, 999);
          await Discount.findByIdAndUpdate(discount._id, { endDate: end });
          fixed++;
        }
      }

      res.json({ success: true, fixed });
    } catch (error) {
      console.error('Fix dates error:', error);
      res.status(500).json({ error: 'Failed to fix discount dates' });
    }
  });

  router.delete('/api/discounts/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { guildId } = req.query;
      const { Discount } = await import('../models');

      // Get guildId before deleting
      const discount = await Discount.findById(id);
      const discountGuildId = discount?.guildId || guildId as string;

      await Discount.findByIdAndDelete(id);

      // Broadcast discount update
      if (discountGuildId) {
        await broadcastDiscountUpdate(discountGuildId);
        // Refresh embeds for this guild
        await refreshAllEmbeds(client, discountGuildId);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Discount delete error:', error);
      res.status(500).json({ error: 'Failed to delete discount' });
    }
  });

  router.get('/api/custom-embeds', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId } = req.query;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId required' });
      }

      const { CustomEmbed } = await import('../models');
      const embeds = await CustomEmbed.find({ guildId }).sort({ createdAt: -1 });
      res.json(embeds);
    } catch (error) {
      console.error('Custom embed fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch custom embeds' });
    }
  });

  router.post('/api/custom-embeds', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId, title, description, color, imageUrl, thumbnailUrl, footerText, channelId, fields, prices, buttons, discountId } = req.body;

      const { CustomEmbed } = await import('../models');
      const embed = await CustomEmbed.create({
        guildId,
        title,
        description,
        color: color || '#5865F2',
        imageUrl,
        thumbnailUrl,
        footerText,
        channelId,
        discountId: discountId || null,
        fields: fields || [],
        prices: prices || [],
        buttons: buttons || []
      });

      res.json(embed);
    } catch (error) {
      console.error('Custom embed create error:', error);
      res.status(500).json({ error: 'Failed to create custom embed' });
    }
  });

  router.post('/api/custom-embeds/:id/send', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { CustomEmbed, Discount } = await import('../models');

      const embedConfig = await CustomEmbed.findById(id);
      if (!embedConfig) {
        return res.status(404).json({ error: 'Embed not found' });
      }

      const guild = client.guilds.cache.get(embedConfig.guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const channel = embedConfig.channelId ? guild.channels.cache.get(embedConfig.channelId) : null;
      if (!channel || !channel.isTextBased()) {
        return res.status(404).json({ error: 'Channel not found or not text-based' });
      }

      // Delete old message if it exists
      if (embedConfig.messageId) {
        try {
          const oldMessage = await channel.messages.fetch(embedConfig.messageId);
          await oldMessage.delete();
          console.log(`Deleted old embed message ${embedConfig.messageId}`);
        } catch (error) {
          console.log(`Could not delete old message (may already be deleted): ${error}`);
        }
      }

      // Check for embed-specific discount or global active discount
      const now = new Date();
      let activeDiscount = null;
      if (embedConfig.discountId) {
        activeDiscount = await Discount.findOne({
          _id: embedConfig.discountId,
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now }
        });
      }
      
      // If no embed-specific discount, check for global active discount
      if (!activeDiscount) {
        activeDiscount = await Discount.findOne({
          guildId: embedConfig.guildId,
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now }
        });
      }

      const { EmbedBuilder } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(embedConfig.title)
        .setColor(embedConfig.color as any);

      if (embedConfig.description) {
        embed.setDescription(embedConfig.description);
      }

      // Add custom fields
      if (embedConfig.fields && embedConfig.fields.length > 0) {
        embedConfig.fields.forEach(field => {
          embed.addFields({
            name: field.name,
            value: field.value,
            inline: field.inline || false
          });
        });
      }

      // Add pricing with discount
      if (embedConfig.prices && embedConfig.prices.length > 0) {
        let priceText = '';

        if (activeDiscount) {
          priceText += `**${activeDiscount.discountPercentage}% OFF SALE!**\n\n`;
        }

        embedConfig.prices.forEach(priceItem => {
          const originalPrice = priceItem.price;
          let finalPrice = originalPrice;

          if (activeDiscount) {
            finalPrice = originalPrice - (originalPrice * activeDiscount.discountPercentage / 100);
            priceText += `▸ **${priceItem.name}** – ~~${priceItem.currency}${originalPrice}~~ **${priceItem.currency}${finalPrice.toFixed(0)}**\n`;
          } else {
            priceText += `▸ **${priceItem.name}** – ${priceItem.currency}${originalPrice}\n`;
          }
        });

        embed.addFields({
          name: 'Prices',
          value: priceText,
          inline: false
        });
      }

      if (embedConfig.imageUrl) embed.setImage(embedConfig.imageUrl);
      if (embedConfig.thumbnailUrl) embed.setThumbnail(embedConfig.thumbnailUrl);
      if (embedConfig.footerText) embed.setFooter({ text: embedConfig.footerText });
      embed.setTimestamp();

      // Create buttons if configured
      const components = [];
      if (embedConfig.buttons && embedConfig.buttons.length > 0) {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const row = new ActionRowBuilder<ButtonBuilder>();
        
        for (const btn of embedConfig.buttons) {
          const buttonStyle = ButtonStyle[btn.style as keyof typeof ButtonStyle] || ButtonStyle.Primary;
          const button = new ButtonBuilder()
            .setCustomId(`channel_redirect_${btn.targetChannelId}`)
            .setLabel(btn.label)
            .setStyle(buttonStyle);
          row.addComponents(button);
        }
        components.push(row);
      }

      const messagePayload: any = { embeds: [embed] };
      if (components.length > 0) messagePayload.components = components;

      const message = await channel.send(messagePayload);
      
      // Store the message ID for future updates
      await CustomEmbed.findByIdAndUpdate(id, { messageId: message.id });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Embed send error:', error);
      res.status(500).json({ error: 'Failed to send embed' });
    }
  });

  router.put('/api/custom-embeds/:id/discount', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { discountId } = req.body;
      const { CustomEmbed } = await import('../models');
      
      const embed = await CustomEmbed.findByIdAndUpdate(
        id,
        { discountId: discountId || null },
        { new: true }
      );
      
      if (!embed) {
        return res.status(404).json({ error: 'Embed not found' });
      }

      // Refresh this embed
      await refreshAllEmbeds(client, embed.guildId);
      
      res.json(embed);
    } catch (error) {
      console.error('Embed discount update error:', error);
      res.status(500).json({ error: 'Failed to update embed discount' });
    }
  });

  router.delete('/api/custom-embeds/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { CustomEmbed } = await import('../models');
      await CustomEmbed.findByIdAndDelete(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Custom embed delete error:', error);
      res.status(500).json({ error: 'Failed to delete custom embed' });
    }
  });

  router.get('/api/youtube-configs', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId } = req.query;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId required' });
      }

      const { YouTubeConfig } = await import('../models');
      const configs = await YouTubeConfig.find({ guildId });
      res.json(configs);
    } catch (error) {
      console.error('YouTube config fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch YouTube configs' });
    }
  });

  router.post('/api/youtube-configs', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { guildId, youtubeChannelId, channelId } = req.body;
      
      const { YouTubeConfig } = await import('../models');
      const config = await YouTubeConfig.create({
        guildId,
        youtubeChannelId,
        channelId,
        checkInterval: 60000
      });

      res.json(config);
    } catch (error) {
      console.error('YouTube config create error:', error);
      res.status(500).json({ error: 'Failed to create YouTube config' });
    }
  });

  router.delete('/api/youtube-configs/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { YouTubeConfig } = await import('../models');
      await YouTubeConfig.findByIdAndDelete(id);
      res.json({ success: true });
    } catch (error) {
      console.error('YouTube config delete error:', error);
      res.status(500).json({ error: 'Failed to delete YouTube config' });
    }
  });

  return router;
}