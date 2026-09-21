'use client';

import { useT } from '@/lib/i18n.client';

/**
 * Printing is what turns the page into the document: the print stylesheet
 * drops everything but the sheet and sets A4 landscape, so "save as PDF" from
 * the browser's own dialogue gives the file people attach to an application.
 */
export function PrintButton() {
  const t = useT();
  return (
    <button className="btn btn-primary btn-sm" type="button" onClick={() => window.print()}>
      {t('اطبع أو احفظ PDF', 'Print or save as PDF')}
    </button>
  );
}
