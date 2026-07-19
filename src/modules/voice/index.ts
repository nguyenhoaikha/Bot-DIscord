import { Client, VoiceState, ChannelType, GuildChannel } from 'discord.js';
import { BaseModule } from '../../structures/BaseModule';
import { ModuleManifest } from '../../types';
import { EventHandler } from '../../core/EventHandler';

const tempChannels = new Map<string, string>();

export class VoiceModule extends BaseModule {
  manifest: ModuleManifest = {
    name: 'Voice Creator',
    description: 'Join-to-Create voice channel system',
    version: '1.0.0',
    enabled: true,
    commands: [],
    events: ['voiceStateUpdate'],
    dependencies: ['Core']
  };

  private creatorChannelId = '';

  async initialize(client: Client): Promise<void> {
    await super.initialize(client);

    EventHandler.getInstance().register({
      name: 'voiceStateUpdate',
      execute: async (oldState: VoiceState, newState: VoiceState) => {
        await this.handleVoiceStateUpdate(oldState, newState);
      }
    });

    this.logger.info('VoiceModule', 'Voice Creator module initialized');
  }

  setCreatorChannelId(id: string) {
    this.creatorChannelId = id;
  }

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const creatorId = this.getCreatorChannelId(guild);

    if (newState.channelId === creatorId) {
      try {
        const parentId = newState.channel?.parentId;
        const tempChannel = await guild.channels.create({
          name: `🔊 ${member.displayName}'s Room`,
          type: ChannelType.GuildVoice,
          parent: parentId || undefined,
          reason: 'Voice Creator - User joined create channel',
          permissionOverwrites: [
            {
              id: member.id,
              allow: ['ManageChannels', 'MuteMembers', 'DeafenMembers', 'MoveMembers']
            },
            {
              id: guild.roles.everyone.id,
              allow: ['Connect', 'Speak']
            }
          ]
        });

        tempChannels.set(tempChannel.id, member.id);

        await member.voice.setChannel(tempChannel);
      } catch (error) {
        this.logger.error('VoiceModule', 'Failed to create temp channel', error as Error);
      }
    }

    if (oldState.channelId && tempChannels.has(oldState.channelId)) {
      const channel = oldState.channel;
      if (channel && channel.members.size === 0) {
        tempChannels.delete(channel.id);
        try {
          await channel.delete('Voice Creator - Channel empty');
        } catch { }
      }
    }
  }

  private getCreatorChannelId(guild: import('discord.js').Guild): string {
    if (this.creatorChannelId) return this.creatorChannelId;

    const creatorChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildVoice && c.name.includes('Join to Create')
    );
    if (creatorChannel) {
      this.creatorChannelId = creatorChannel.id;
    }
    return creatorChannel?.id || '';
  }
}