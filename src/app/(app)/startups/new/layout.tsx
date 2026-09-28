import { localizedTitle } from '@/lib/i18n.server';

// The page is a client form; its title is set here.
export const generateMetadata = localizedTitle('شركة ناشئة جديدة — TechMood', 'New startup — TechMood');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
