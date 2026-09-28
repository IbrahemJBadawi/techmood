import { SettingsNav } from './SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="st-layout">
      <SettingsNav />
      <div className="st-body">{children}</div>
    </div>
  );
}
