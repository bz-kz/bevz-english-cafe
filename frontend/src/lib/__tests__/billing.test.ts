import axios from 'axios';
import { createCheckout, createPortal, NoSubscriptionError } from '../billing';

jest.mock('axios');
jest.mock('@/lib/firebase', () => ({
  firebaseAuth: {
    authStateReady: jest.fn().mockResolvedValue(undefined),
    currentUser: { getIdToken: jest.fn().mockResolvedValue('tok') },
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('billing lib', () => {
  afterEach(() => jest.clearAllMocks());

  it('createCheckout posts plan and returns url', async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://co/x' } });
    const url = await createCheckout('standard');
    expect(url).toBe('https://co/x');
    const [endpoint, body] = mockedAxios.post.mock.calls[0];
    expect(endpoint).toMatch(/\/api\/v1\/billing\/checkout$/);
    expect(body).toEqual({ plan: 'standard' });
  });

  it('createPortal returns url', async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://portal/x' } });
    expect(await createPortal()).toBe('https://portal/x');
  });

  it('createPortal throws NoSubscriptionError on 409 no_subscription', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 409, data: { detail: { code: 'no_subscription' } } },
    });
    await expect(createPortal()).rejects.toBeInstanceOf(NoSubscriptionError);
  });

  it('createPortal rethrows other errors', async () => {
    const err = { response: { status: 500, data: {} } };
    mockedAxios.post.mockRejectedValue(err);
    await expect(createPortal()).rejects.toBe(err);
  });
});
