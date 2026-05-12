/**
 * Tabs Component
 * タブ切り替えコンポーネント
 */

'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';

interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  defaultActiveTab?: string;
  onTabChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

const variantClasses = {
  default: {
    container: 'border-b border-gray-200',
    tab: 'px-4 py-2 font-medium text-sm border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300',
    activeTab: 'text-primary-600 border-primary-600',
    disabledTab: 'text-gray-400 cursor-not-allowed'
  },
  pills: {
    container: 'bg-gray-100 p-1 rounded-lg',
    tab: 'px-4 py-2 font-medium text-sm rounded-md hover:bg-white hover:shadow-sm',
    activeTab: 'bg-white shadow-sm text-primary-600',
    disabledTab: 'text-gray-400 cursor-not-allowed'
  },
  underline: {
    container: '',
    tab: 'px-4 py-2 font-medium text-sm relative hover:text-gray-700',
    activeTab: 'text-primary-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary-600',
    disabledTab: 'text-gray-400 cursor-not-allowed'
  }
};

export function Tabs({ 
  items, 
  defaultActiveTab, 
  onTabChange,
  variant = 'default',
  className 
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(
    defaultActiveTab || items[0]?.id || ''
  );

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled) return;
    
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const activeItem = items.find(item => item.id === activeTab);
  const classes = variantClasses[variant];

  return (
    <div className={className}>
      {/* タブヘッダー */}
      <div className={cn('flex', classes.container)}>
        {items.map((item) => (
          <button
            key={item.id}
            className={cn(
              classes.tab,
              activeTab === item.id && classes.activeTab,
              item.disabled && classes.disabledTab
            )}
            onClick={() => handleTabClick(item.id, item.disabled)}
            disabled={item.disabled}
            role="tab"
            aria-selected={activeTab === item.id}
            aria-controls={`tabpanel-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="mt-4">
        {activeItem && (
          <div
            id={`tabpanel-${activeItem.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeItem.id}`}
          >
            {activeItem.content}
          </div>
        )}
      </div>
    </div>
  );
}

interface TabPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ children, className }: TabPanelProps) {
  return (
    <div className={cn('py-4', className)}>
      {children}
    </div>
  );
}