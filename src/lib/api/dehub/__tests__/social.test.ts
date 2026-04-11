import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/lib/api/dehub/social-edge-client', () => ({
  invokeDehubSocialApi: (...args: unknown[]) => invokeMock(...args),
}));

beforeEach(() => {
  localStorage.setItem('dehub_token', 'test-jwt-token');
  localStorage.setItem('dehub_wallet', '0xwallettest');
  localStorage.setItem('dehub_token_timestamp', String(Date.now()));
  invokeMock.mockReset();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('followUser', () => {
  it('invokes follow.follow edge action', async () => {
    invokeMock.mockResolvedValue({ ok: true });
    const { followUser } = await import('@/lib/api/dehub/social');

    const result = await followUser('0xabc');

    expect(invokeMock).toHaveBeenCalledWith({
      action: 'follow.follow',
      targetAddress: '0xabc',
    });
    expect(result).toEqual({ result: true });
  });

  it('returns false when edge throws', async () => {
    invokeMock.mockRejectedValue(new Error('fail'));
    const { followUser } = await import('@/lib/api/dehub/social');

    const result = await followUser('0xabc');
    expect(result).toEqual({ result: false });
  });
});

describe('unfollowUser', () => {
  it('invokes follow.unfollow', async () => {
    invokeMock.mockResolvedValue({ ok: true });
    const { unfollowUser } = await import('@/lib/api/dehub/social');

    await unfollowUser('0xdef');

    expect(invokeMock).toHaveBeenCalledWith({
      action: 'follow.unfollow',
      targetAddress: '0xdef',
    });
  });
});

describe('voteOnPost', () => {
  it('returns vote response from edge function', async () => {
    invokeMock.mockResolvedValue({
      ok: true,
      success: true,
      tokenId: 42,
      voteType: 'for',
    });
    const { voteOnPost } = await import('@/lib/api/dehub/social');

    const result = await voteOnPost({ tokenId: 42, voteType: 'for' });

    expect(invokeMock).toHaveBeenCalledWith({
      action: 'engagement.vote',
      tokenId: 42,
      voteType: 'for',
    });
    expect(result).toEqual({
      success: true,
      tokenId: 42,
      voteType: 'for',
    });
  });

  it('returns failure when not authenticated', async () => {
    localStorage.clear();
    const { voteOnPost } = await import('@/lib/api/dehub/social');

    const result = await voteOnPost({ tokenId: 1, voteType: 'for' });
    expect(result.success).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
