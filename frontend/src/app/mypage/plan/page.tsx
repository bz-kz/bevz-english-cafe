import { Suspense } from 'react';
import { PlanPageClient } from './_components/PlanPageClient';

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">読み込み中…</div>}>
      <PlanPageClient />
    </Suspense>
  );
}
