jest.mock('@/lib/firebase', () => ({
  firebaseAuth: { currentUser: { getIdToken: () => Promise.resolve('t') } },
}));

import {
  searchAdminUsers,
  adminForceBook,
  adminForceCancel,
} from '../admin-booking';

describe('admin-booking lib exports', () => {
  it('exports the 3 functions', () => {
    expect(typeof searchAdminUsers).toBe('function');
    expect(typeof adminForceBook).toBe('function');
    expect(typeof adminForceCancel).toBe('function');
  });
});
