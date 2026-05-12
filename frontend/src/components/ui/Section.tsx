import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionProps {
  children: ReactNode;
  className?: string;
  background?: 'white' | 'gray' | 'primary';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
}

const Section = ({ 
  children, 
  className, 
  background = 'white',
  padding = 'lg'
}: SectionProps) => {
  const backgroundClasses = {
    white: 'bg-white',
    gray: 'bg-gray-50',
    primary: 'bg-primary-50',
  };

  const paddingClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-16',
    xl: 'py-20',
  };

  return (
    <section
      className={cn(
        backgroundClasses[background],
        paddingClasses[padding],
        className
      )}
    >
      <div className="container-custom">
        {children}
      </div>
    </section>
  );
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  centered?: boolean;
  className?: string;
}

const SectionHeader = ({ 
  title, 
  subtitle, 
  description, 
  centered = true,
  className 
}: SectionHeaderProps) => {
  return (
    <div className={cn(
      'mb-12',
      centered && 'text-center',
      className
    )}>
      {subtitle && (
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary-600">
          {subtitle}
        </p>
      )}
      <h2 className="mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className={cn(
          'text-lg text-gray-600',
          centered && 'mx-auto max-w-3xl'
        )}>
          {description}
        </p>
      )}
    </div>
  );
};

export { Section, SectionHeader };