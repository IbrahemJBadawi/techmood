import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { AccountForm } from './AccountForm';

export const metadata = { title: 'Receiving accounts — TechMood' };

/**
 * Where TechMood receives money. The numbers live in the database, never in
 * code; since 0075 they are column-locked, read here through a function that
 * checks the admin, and shown to a payer only for the one payment they owe.
 */
export default async function AccountsPage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: methods } = await supabase.rpc('admin_payment_accounts');

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('حسابات استلام TechMood', 'TechMood receiving accounts')}</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '66ch' }}>
          {t('الأرقام مخفية جزئياً هنا، وتظهر كاملة لمن يدفع دفعة مفتوحة على هذه الطريقة فقط. غيّر الحساب من هنا دون تعديل أي كود.',
             'Numbers are masked here, and shown in full only to someone with an open payment on that method. Change an account here without touching any code.')}
        </p>
      </section>
      <div className="stack">
        {(methods ?? []).map((method) => <AccountForm key={method.key} method={method} />)}
      </div>
    </>
  );
}
