'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    setPending(true);
    setError('');

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('accept_team_invite', { p_token: token });

    setPending(false);

    if (rpcError || !data) {
      setError('تعذّر قبول الدعوة — ربما انتهت صلاحيتها أو أنها ليست لك.');
      return;
    }

    router.push(`/teams/${data}`);
  }

  return (
    <>
      {error && <p className="notice notice-danger" style={{ marginTop: 14 }}>{error}</p>}
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={accept} disabled={pending}>
        {pending ? 'جارٍ الانضمام…' : 'انضم للفريق'}
      </button>
    </>
  );
}
