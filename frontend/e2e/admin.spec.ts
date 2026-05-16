import { test, expect } from './helpers/auth';
import { ROUTES } from './helpers/selectors';

test.describe('admin gating', () => {
  test('non-admin user is redirected away from /admin', async ({ asUser }) => {
    // useAdminGuard: logged-in but !isAdmin → router.push('/').
    await asUser.goto(ROUTES.adminLessons);
    await expect(asUser).toHaveURL(/\/$|\/login/);
    expect(asUser.url()).not.toContain('/admin/lessons');
  });

  test('admin sees lessons admin + detail', async ({ asAdmin }) => {
    await asAdmin.goto(ROUTES.adminLessons);
    // AdminLayout renders <h1>Admin</h1> only after
    // loading===false && isAdmin (the admin custom claim resolved).
    await expect(asAdmin.getByRole('heading', { name: 'Admin' })).toBeVisible({
      timeout: 15000,
    });
    expect(asAdmin.url()).toContain('/admin/lessons');

    // The seeded open slot renders an edit link a[href^="/admin/lessons/"].
    const row = asAdmin.locator('a[href^="/admin/lessons/"]').first();
    if (await row.count()) {
      await row.click();
      await expect(asAdmin).toHaveURL(/\/admin\/lessons\/.+/);
      await expect(asAdmin.locator('main').first()).toBeVisible();
    }
  });
});
