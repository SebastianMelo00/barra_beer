import type { ReactNode } from 'react';
import { Marco } from '@/components/ui/Marco';

export default function Layout({ children }: { children: ReactNode }) {
  return <Marco>{children}</Marco>;
}
