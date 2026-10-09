import type { Core } from '@strapi/strapi';
import { createSecureLifecycle } from './utils/secureFields';

export default {
  register() {},

  /**
   * Bootstrap runs before the application starts.
   * Here we subscribe secure-field lifecycles for the Users & Permissions
   * plugin so sensitive columns (email, username) are base64-encoded in DB,
   * while decoded plane-text views are served to the application.
   */
  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const userLifecycle = createSecureLifecycle('plugin::users-permissions.user', ['email', 'username']);
    (strapi.db as any).lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      ...userLifecycle,
    });
  },
};
