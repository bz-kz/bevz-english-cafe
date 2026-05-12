/**
 * Badge Component
 * ステータスやカテゴリを表示するバッジコンポーネント
 */

import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-800 border-gray-200',
  primary: 'bg-primary-100 text-primary-800 border-primary-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200'
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-2 text-base'
};

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'md', 
  className 
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    active: { variant: 'success' as const, label: 'アクティブ' },
    inactive: { variant: 'default' as const, label: '非アクティブ' },
    pending: { variant: 'warning' as const, label: '保留中' },
    completed: { variant: 'success' as const, label: '完了' },
    cancelled: { variant: 'error' as const, label: 'キャンセル' }
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      <div className="flex items-center space-x-1">
        <div className={cn(
          'w-2 h-2 rounded-full',
          config.variant === 'success' && 'bg-green-500',
          config.variant === 'warning' && 'bg-yellow-500',
          config.variant === 'error' && 'bg-red-500',
          config.variant === 'default' && 'bg-gray-500'
        )} />
        <span>{config.label}</span>
      </div>
    </Badge>
  );
}