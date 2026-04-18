import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared/vitest.config.ts',
  'packages/design-system/vitest.config.ts',
  'apps/web/vitest.config.ts',
  'apps/admin/vitest.config.ts',
  'apps/api/vitest.config.ts',
]);
