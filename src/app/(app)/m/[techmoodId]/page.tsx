import { localizedTitle } from '@/lib/i18n.server';

import { ProfileBody } from '../../../u/[techmoodId]/ProfileBody';

export const generateMetadata = localizedTitle('ملف عضو — TechMood', 'A member — TechMood');

/** Another member's profile, inside the app's shell (the public link is /u/…). */
export default async function MemberPage({ params }: { params: Promise<{ techmoodId: string }> }) {
  const { techmoodId } = await params;
  return <ProfileBody techmoodId={techmoodId} inApp />;
}
