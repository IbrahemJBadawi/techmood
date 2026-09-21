'use client';

import { useT } from '@/lib/i18n.client';

import { reviewRole } from './actions';

export function RoleReviewForm({ roleId }: { roleId: string }) {
  const t = useT();

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <form action={reviewRole}>
        <input type="hidden" name="role_id" value={roleId} />
        <input type="hidden" name="decision" value="approve" />
        <button className="btn btn-primary btn-sm" type="submit">{t('قبول', 'Approve')}</button>
      </form>
      <form action={reviewRole}>
        <input type="hidden" name="role_id" value={roleId} />
        <input type="hidden" name="decision" value="reject" />
        <button className="btn btn-ghost btn-sm" type="submit">{t('رفض', 'Reject')}</button>
      </form>
    </div>
  );
}
