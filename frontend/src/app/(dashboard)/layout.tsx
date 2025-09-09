import type { Metadata } from 'next';
import ClientShell from './Clientshell';

export const metadata: Metadata = {
  title: 'โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม: แผนกชีวาภิบาล',
  description: 'แผนกชีวาภิบาล',
  icons: { icon: '/favicon.ico' }, // เส้นทางจาก public/
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
