import { Guild, PermissionResolvable, PermissionsBitField, Role } from 'discord.js';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export class PermissionManager {
  private static instance: PermissionManager;

  private constructor() {}

  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  async setRolePermissions(guild: Guild, role: Role, permissions: PermissionResolvable[]): Promise<void> {
    try {
      const perms = new PermissionsBitField();
      for (const perm of permissions) {
        perms.add(perm);
      }
      await role.setPermissions(perms);
      logger.info('PermissionManager', `Set permissions for role ${role.name}`);
    } catch (error) {
      logger.error('PermissionManager', `Failed to set permissions for ${role.name}`, error as Error);
    }
  }

  hasPermission(memberPermissions: PermissionsBitField, permission: PermissionResolvable): boolean {
    return memberPermissions.has(permission);
  }

  hasAnyPermission(memberPermissions: PermissionsBitField, permissions: PermissionResolvable[]): boolean {
    return permissions.some(p => memberPermissions.has(p));
  }

  hasAllPermissions(memberPermissions: PermissionsBitField, permissions: PermissionResolvable[]): boolean {
    return permissions.every(p => memberPermissions.has(p));
  }
}
