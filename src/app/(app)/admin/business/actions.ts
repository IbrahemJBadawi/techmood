'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/** Where a company's message stands: new, answered, or closed (0150). */
export async function setInquiryStatus(formData: FormData) {
  const supabase = await createClient();
  const status = String(formData.get('status') ?? '');
  if (!['new', 'contacted', 'closed'].includes(status)) return;
  await supabase.rpc('set_business_inquiry_status', { p_id: String(formData.get('id') ?? ''), p_status: status as 'new' | 'contacted' | 'closed' });
  revalidatePath('/admin/business');
}
