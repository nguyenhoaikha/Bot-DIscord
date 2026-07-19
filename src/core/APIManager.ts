import axios, { AxiosInstance } from 'axios';
import { Logger } from './Logger';
import { config } from '../config';

const logger = Logger.getInstance();

export class APIManager {
  private static instance: APIManager;
  public roblox: AxiosInstance;
  public discord: AxiosInstance;

  private constructor() {
    this.roblox = axios.create({
      baseURL: 'https://api.roblox.com',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.robloxCookie ? { Cookie: `.ROBLOSECURITY=${config.robloxCookie}` } : {})
      }
    });

    this.discord = axios.create({
      baseURL: 'https://discord.com/api/v10',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${config.token}`
      }
    });
  }

  static getInstance(): APIManager {
    if (!APIManager.instance) {
      APIManager.instance = new APIManager();
    }
    return APIManager.instance;
  }

  async robloxFetchUser(userId: number): Promise<any> {
    try {
      const { data } = await this.roblox.get(`/users/${userId}`);
      return data;
    } catch (error) {
      logger.error('APIManager', `Roblox API: Failed to fetch user ${userId}`, error as Error);
      return null;
    }
  }

  async robloxFetchAvatar(userId: number): Promise<any> {
    try {
      const { data } = await this.roblox.get(`/avatar/v1/users/${userId}/avatar`);
      return data;
    } catch (error) {
      return null;
    }
  }

  async robloxFetchGame(universeId: number): Promise<any> {
    try {
      const { data } = await this.roblox.get(`/universes/v1/${universeId}`);
      return data;
    } catch (error) {
      return null;
    }
  }

  async robloxFetchGroup(groupId: number): Promise<any> {
    try {
      const { data } = await this.roblox.get(`/groups/v1/groups/${groupId}`);
      return data;
    } catch (error) {
      return null;
    }
  }

  async robloxFetchInventory(userId: number): Promise<any> {
    try {
      const { data } = await this.roblox.get(`/inventory/v1/users/${userId}/assets/collectibles`);
      return data;
    } catch (error) {
      return null;
    }
  }

  async robloxFetchBadges(userId: number): Promise<any> {
    try {
      const { data } = await this.roblox.get(`/badges/v1/users/${userId}/badges`);
      return data;
    } catch (error) {
      return null;
    }
  }

  async robloxSearchUser(username: string): Promise<any> {
    try {
      const { data } = await this.roblox.get(`/users/search`, { params: { keyword: username, limit: 10 } });
      return data;
    } catch (error) {
      return null;
    }
  }

  async robloxFetchPresence(userIds: number[]): Promise<any> {
    try {
      const { data } = await this.roblox.post('/presence/v1/presence/users', { userIds });
      return data;
    } catch (error) {
      return null;
    }
  }

  async robloxFetchThumbnail(userIds: number[], size: string = '720x720'): Promise<any> {
    try {
      const { data } = await this.roblox.get('/thumbnails/v1/users/avatar', {
        params: { userIds: userIds.join(','), size, format: 'Png' }
      });
      return data;
    } catch (error) {
      return null;
    }
  }
}
