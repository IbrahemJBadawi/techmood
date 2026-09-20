'use client';

import { reviewRole } from './actions';

export function RoleReviewForm({ roleId }: { roleId: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <form action={reviewRole}>
        <input type="hidden" name="role_id" value={roleId} />
        <input type="hidden" name="decision" value="approve" />
        <button className="btn btn-primary btn-sm" type="submit">قبول</button>
      </form>
      <form action={reviewRole}>
        <input type="hidden" name="role_id" value={roleId} />
        <input type="hidden" name="decision" value="reject" />
        <button className="btn btn-ghost btn-sm" type="submit">رفض</button>
      </form>
    </div>
  );
}
