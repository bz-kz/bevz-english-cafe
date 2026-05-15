'use client';

import type { Plan } from '@/lib/booking';

const PLAN_INFO: Record<Plan, { label: string; price: string; coma: number }> =
  {
    light: { label: 'ライト', price: '6,000', coma: 4 },
    standard: { label: 'スタンダード', price: '10,000', coma: 8 },
    intensive: { label: '集中', price: '15,000', coma: 16 },
  };

interface Props {
  plan: Plan;
  currentPlan: Plan | null;
  onSelect: (plan: Plan) => void;
  busy: boolean;
}

export function PlanCard({ plan, currentPlan, onSelect, busy }: Props) {
  const info = PLAN_INFO[plan];
  const isCurrent = plan === currentPlan;
  return (
    <div className="flex flex-col rounded border bg-white p-4 text-center shadow-sm">
      <h3 className="text-lg font-semibold">{info.label}</h3>
      <p className="mt-2 text-2xl font-bold">¥{info.price}</p>
      <p className="text-xs text-gray-500">/ 月 (税抜)</p>
      <p className="mt-2 text-sm">{info.coma} コマ</p>
      <button
        type="button"
        disabled={isCurrent || busy}
        onClick={() => onSelect(plan)}
        className="mt-4 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:bg-gray-300"
      >
        {isCurrent ? 'ご利用中' : '選択'}
      </button>
    </div>
  );
}
