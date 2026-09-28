import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT, localizedTitle } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { money } from '@/lib/booking';
import { PrintButton } from '@/app/verify/[code]/PrintButton';

export const generateMetadata = localizedTitle('فاتورة — TechMood', 'Invoice — TechMood');

/**
 * One invoice, laid out to print (0097). The print stylesheet drops the app
 * around it and sets an A4 portrait page, so "save as PDF" from the browser's
 * own dialogue gives the PDF. Only the payer and the admins can open it — the
 * row's policy decides, not this page.
 */
export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: invoice }, { data: issuerRows }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle(),
    supabase.rpc('invoice_issuer'),
  ]);
  if (!invoice) notFound();
  const issuer = issuerRows?.[0];
  const refunded = invoice.status === 'refunded';

  return (
    <>
      <div className="row-actions no-print" style={{ marginBottom: 16 }}>
        <Link className="btn btn-ghost btn-sm" href="/wallet?tab=invoices">{t('→ فواتيري', '← My invoices')}</Link>
        <PrintButton />
      </div>

      <article className="panel invoice-sheet">
        <header className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.3rem' }}>{t('فاتورة', 'Invoice')}</h1>
            <p className="id-chip eng" style={{ marginTop: 6 }}>{invoice.invoice_no}</p>
          </div>
          <div style={{ textAlign: 'end' }}>
            <strong>{issuer?.name ?? 'TechMood'}</strong>
            {issuer?.details && <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>{issuer.details}</p>}
          </div>
        </header>

        {refunded && (
          <p className="notice notice-danger" style={{ marginTop: 14 }}>
            {t('مُستردّة', 'Refunded')}
            {invoice.refunded_at && <> — <span className="date">{formatDateTime(locale, invoice.refunded_at)}</span></>}
          </p>
        )}

        <dl className="invoice-meta" style={{ marginTop: 18 }}>
          <div><dt>{t('تاريخ الإصدار', 'Issued')}</dt><dd className="eng">{formatDateTime(locale, invoice.issued_at)}</dd></div>
          <div><dt>{t('الدافع', 'Billed to')}</dt><dd>{invoice.payer_name}</dd></div>
          {invoice.payer_account && <div><dt>{t('من حساب', 'Paid from')}</dt><dd className="eng">{invoice.payer_account}</dd></div>}
          {invoice.method_label && <div><dt>{t('طريقة الدفع', 'Method')}</dt><dd>{invoice.method_label}</dd></div>}
          {invoice.payment_code && <div><dt>{t('رقم الدفعة', 'Payment')}</dt><dd className="eng">{invoice.payment_code}</dd></div>}
          {invoice.reference && <div><dt>{t('المرجع', 'Reference')}</dt><dd className="eng">{invoice.reference}</dd></div>}
        </dl>

        <table className="data" style={{ marginTop: 18 }}>
          <thead>
            <tr><th>{t('البيان', 'Description')}</th><th style={{ textAlign: 'end' }}>{t('المبلغ', 'Amount')}</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{invoice.description_ar}</td>
              <td className="eng" style={{ textAlign: 'end' }}>{money(invoice.amount_usd)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th>{t('الإجمالي', 'Total')}</th>
              <th className="eng" style={{ textAlign: 'end' }}>{money(invoice.amount_usd)}</th>
            </tr>
            {invoice.paid_currency !== 'USD' && invoice.paid_amount && (
              <tr>
                <td className="muted">{t('المبلغ المدفوع فعلاً', 'Amount actually sent')}</td>
                <td className="eng muted" style={{ textAlign: 'end' }}>{invoice.paid_amount} {invoice.paid_currency}</td>
              </tr>
            )}
          </tfoot>
        </table>

        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 18 }}>
          {t('صدرت هذه الفاتورة تلقائياً عند تأكيد TechMood لاستلام الدفعة.', 'This invoice was issued automatically when TechMood confirmed receiving the payment.')}
        </p>
      </article>
    </>
  );
}
