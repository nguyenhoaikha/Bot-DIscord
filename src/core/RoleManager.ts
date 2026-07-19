import { Guild, ColorResolvable } from 'discord.js';
import { DefaultRoles, RoleStructure } from '../types';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export class RoleManager {
  private static instance: RoleManager;

  private constructor() {}

  static getInstance(): RoleManager {
    if (!RoleManager.instance) {
      RoleManager.instance = new RoleManager();
    }
    return RoleManager.instance;
  }

  async createDefaultRoles(guild: Guild): Promise<Map<string, string>> {
    const roleMap = new Map<string, string>();
    const sortedRoles = [...DefaultRoles].sort((a, b) => b.position - a.position);

    for (const roleDef of sortedRoles) {
      try {
        const role = await guild.roles.create({
          name: roleDef.name,
          color: roleDef.color as ColorResolvable,
          permissions: roleDef.permissions,
          mentionable: roleDef.mentionable,
          reason: 'Server Setup'
        });
        roleMap.set(roleDef.name, role.id);
        logger.info('RoleManager', `Created role: ${roleDef.name}`);
      } catch (error) {
        logger.error('RoleManager', `Failed to create role ${roleDef.name}`, error as Error);
      }
    }

    return roleMap;
  }

  async createRole(guild: Guild, name: string, color: ColorResolvable, permissions: string[], reason?: string): Promise<string | null> {
    try {
      const role = await guild.roles.create({
        name,
        color,
        permissions: permissions as any,
        reason: reason || 'Role Management'
      });
      return role.id;
    } catch (error) {
      logger.error('RoleManager', `Failed to create role ${name}`, error as Error);
      return null;
    }
  }

  async assignRole(guild: Guild, userId: string, roleId: string): Promise<boolean> {
    try {
      const member = await guild.members.fetch(userId);
      const role = guild.roles.cache.get(roleId);
      if (member && role) {
        await member.roles.add(role);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('RoleManager', `Failed to assign role`, error as Error);
      return false;
    }
  }

  async removeRole(guild: Guild, userId: string, roleId: string): Promise<boolean> {
    try {
      const member = await guild.members.fetch(userId);
      const role = guild.roles.cache.get(roleId);
      if (member && role) {
        await member.roles.remove(role);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('RoleManager', `Failed to remove role`, error as Error);
      return false;
    }
  }
}
