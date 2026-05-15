import { render, screen, fireEvent } from '@testing-library/react';
import { PlanCard } from '../PlanCard';

describe('PlanCard', () => {
  it('shows name, price, coma and a 選択 button', () => {
    const onSelect = jest.fn();
    render(
      <PlanCard
        plan="standard"
        currentPlan={null}
        onSelect={onSelect}
        busy={false}
      />
    );
    expect(screen.getByText('スタンダード')).toBeInTheDocument();
    expect(screen.getByText(/¥10,000/)).toBeInTheDocument();
    expect(screen.getByText(/8 コマ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /選択/ }));
    expect(onSelect).toHaveBeenCalledWith('standard');
  });

  it('disables and shows ご利用中 for the current plan', () => {
    render(
      <PlanCard
        plan="light"
        currentPlan="light"
        onSelect={jest.fn()}
        busy={false}
      />
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('ご利用中');
  });
});
