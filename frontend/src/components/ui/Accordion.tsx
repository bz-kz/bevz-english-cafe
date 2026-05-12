/**
 * Accordion Component
 * 折りたたみ可能なコンテンツ表示コンポーネント
 */

'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function AccordionItem({ 
  title, 
  children, 
  isOpen = false, 
  onToggle,
  className 
}: AccordionItemProps) {
  return (
    <div className={cn('border border-gray-200 rounded-lg', className)}>
      <button
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900">{title}</span>
        <svg
          className={cn(
            'w-5 h-5 text-gray-500 transition-transform duration-200',
            isOpen && 'transform rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-6 pb-4 text-gray-600">
          {children}
        </div>
      </div>
    </div>
  );
}

interface AccordionProps {
  items: Array<{
    title: string;
    content: React.ReactNode;
  }>;
  allowMultiple?: boolean;
  defaultOpenItems?: number[];
  className?: string;
}

export function Accordion({ 
  items, 
  allowMultiple = false, 
  defaultOpenItems = [],
  className 
}: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(
    new Set(defaultOpenItems)
  );

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      if (!allowMultiple) {
        newOpenItems.clear();
      }
      newOpenItems.add(index);
    }
    
    setOpenItems(newOpenItems);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, index) => (
        <AccordionItem
          key={index}
          title={item.title}
          isOpen={openItems.has(index)}
          onToggle={() => toggleItem(index)}
        >
          {item.content}
        </AccordionItem>
      ))}
    </div>
  );
}