/**
 * Debug Page — dev-only entry. In production this resolves to notFound().
 * 本番ビルドでは _DebugPanel が code-split で除外される。
 */
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

const DebugPanel = dynamic(() => import('./_DebugPanel'), { ssr: false });

export default function DebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <DebugPanel />;
}
