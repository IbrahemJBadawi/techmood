import { BookSessionFab } from '@/components/BookSessionFab';

/** Every academy page keeps «احجز جلسة» a tap away. */
export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BookSessionFab />
    </>
  );
}
