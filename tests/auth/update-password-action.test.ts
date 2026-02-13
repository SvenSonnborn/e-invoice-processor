import { beforeEach, describe, expect, it, mock } from 'bun:test';

let updateUserError: { message: string } | null = null;
const updateUserCalls: Array<{ password: string }> = [];

mock.module('@/src/lib/supabase/server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        updateUser: async (params: { password: string }) => {
          updateUserCalls.push(params);
          return { error: updateUserError };
        },
      },
    }),
}));

mock.module('@/src/lib/db/client', () => ({
  prisma: {
    user: {
      upsert: () => Promise.resolve(null),
    },
  },
}));

mock.module('next/navigation', () => ({
  redirect: (_url: string) => {
    throw new Error('Unexpected redirect in updatePassword test');
  },
}));

import { updatePassword } from '@/app/actions/auth';

function createPasswordFormData(
  password: string,
  confirmPassword: string
): FormData {
  const formData = new FormData();
  formData.set('password', password);
  formData.set('confirmPassword', confirmPassword);
  return formData;
}

describe('updatePassword action', () => {
  beforeEach(() => {
    updateUserError = null;
    updateUserCalls.length = 0;
  });

  it('rejects weak passwords before calling Supabase', async () => {
    const result = await updatePassword(
      createPasswordFormData('short', 'short')
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('mindestens 8 Zeichen');
    }
    expect(updateUserCalls).toHaveLength(0);
  });

  it('rejects non-matching confirmation password', async () => {
    const result = await updatePassword(
      createPasswordFormData('StrongPassword123', 'DifferentPassword123')
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('stimmen nicht überein');
    }
    expect(updateUserCalls).toHaveLength(0);
  });

  it('returns a safe generic message when Supabase update fails', async () => {
    updateUserError = { message: 'Session expired' };

    const result = await updatePassword(
      createPasswordFormData('StrongPassword123', 'StrongPassword123')
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(
        'Passwort konnte nicht aktualisiert werden'
      );
    }
    expect(updateUserCalls).toEqual([{ password: 'StrongPassword123' }]);
  });

  it('updates password successfully for valid recovery session', async () => {
    const result = await updatePassword(
      createPasswordFormData('StrongPassword123', 'StrongPassword123')
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message).toContain('Passwort erfolgreich aktualisiert');
    }
    expect(updateUserCalls).toEqual([{ password: 'StrongPassword123' }]);
  });
});
