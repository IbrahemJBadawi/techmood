import { getT } from '@/lib/i18n.server';

import { deleteCommentAction } from '@/app/(app)/projects/showcase-actions';
import { ConfirmSubmit } from '@/components/ConfirmDialog';

/** Removing a comment: its author, the page's editors and TechMood may (0122). */
export async function DeleteCommentButton({ commentId, code }: { commentId: string; code: string }) {
  const t = await getT();
  return (
    <form action={deleteCommentAction}>
      <input type="hidden" name="comment_id" value={commentId} />
      <input type="hidden" name="code" value={code} />
      <ConfirmSubmit className="sc-mini is-danger" message={t('حذف هذا التعليق؟', 'Delete this comment?')} confirmLabel={t('احذف', 'Delete')}>
        {t('حذف', 'Delete')}
      </ConfirmSubmit>
    </form>
  );
}
