import { ModuleManager } from '../core/ModuleManager';
import { SetupModule } from './setup/index';
import { WelcomeModule } from './welcome/index';
import { VerificationModule } from './verification/index';
import { TicketsModule } from './tickets/index';
import { RobloxModule } from './roblox/index';
import { ModerationModule } from './moderation/index';
import { LoggingModule } from './logging/index';
import { RolesModule } from './roles/index';
import { LevelsModule } from './levels/index';
import { RewardsModule } from './rewards/index';
import { AchievementsModule } from './achievements/index';
import { CommunityModule } from './community/index';
import { AnnouncementsModule } from './announcements/index';
import { EventsModule } from './events/index';
import { BackupModule } from './backup/index';
import { AnalyticsModule } from './analytics/index';
import { MembersModule } from './members/index';
import { NotificationsModule } from './notifications/index';
import { AIModule } from './ai/index';
import { ThemeModule } from './theme/index';
import { UtilityModule } from './utility/index';
import { SecurityModule } from './security/index';
import { AutoModModule } from './automod/index';
import { VoiceModule } from './voice/index';

export function registerAllModules(): void {
  const moduleManager = ModuleManager.getInstance();

  const modules = [
    new SetupModule(),
    new WelcomeModule(),
    new VerificationModule(),
    new TicketsModule(),
    new RobloxModule(),
    new ModerationModule(),
    new LoggingModule(),
    new RolesModule(),
    new LevelsModule(),
    new RewardsModule(),
    new AchievementsModule(),
    new CommunityModule(),
    new AnnouncementsModule(),
    new EventsModule(),
    new BackupModule(),
    new AnalyticsModule(),
    new MembersModule(),
    new NotificationsModule(),
    new AIModule(),
    new ThemeModule(),
    new UtilityModule(),
    new SecurityModule(),
    new AutoModModule(),
    new VoiceModule()
  ];

  for (const mod of modules) {
    moduleManager.register(mod);
  }
}
