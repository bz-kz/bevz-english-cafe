/**
 * Utility Functions Tests
 * ユーティリティ関数のユニットテスト
 */

import { cn } from '../utils';

describe('Utility Functions', () => {
  describe('cn (className utility)', () => {
    it('merges class names correctly', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('handles conditional classes', () => {
      const result = cn('base', true && 'conditional', false && 'hidden');
      expect(result).toBe('base conditional');
    });

    it('handles undefined and null values', () => {
      const result = cn('base', undefined, null, 'valid');
      expect(result).toBe('base valid');
    });

    it('handles empty strings', () => {
      const result = cn('base', '', 'valid');
      expect(result).toBe('base valid');
    });

    it('handles arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('handles objects with boolean values', () => {
      const result = cn({
        'class1': true,
        'class2': false,
        'class3': true,
      });
      expect(result).toBe('class1 class3');
    });

    it('merges Tailwind classes correctly (removes duplicates)', () => {
      const result = cn('px-4 py-2', 'px-6 bg-blue-500');
      // px-6 should override px-4
      expect(result).toContain('px-6');
      expect(result).toContain('py-2');
      expect(result).toContain('bg-blue-500');
      expect(result).not.toContain('px-4');
    });

    it('handles complex Tailwind class merging', () => {
      const result = cn(
        'bg-red-500 text-white px-4 py-2',
        'bg-blue-500 px-6',
        'hover:bg-blue-600'
      );
      
      expect(result).toContain('bg-blue-500'); // bg-blue-500 overrides bg-red-500
      expect(result).toContain('text-white');
      expect(result).toContain('px-6'); // px-6 overrides px-4
      expect(result).toContain('py-2');
      expect(result).toContain('hover:bg-blue-600');
      expect(result).not.toContain('bg-red-500');
      expect(result).not.toContain('px-4');
    });

    it('handles responsive classes correctly', () => {
      const result = cn(
        'text-sm md:text-base lg:text-lg',
        'md:text-xl'
      );
      
      expect(result).toContain('text-sm');
      expect(result).toContain('md:text-xl'); // md:text-xl overrides md:text-base
      expect(result).toContain('lg:text-lg');
      expect(result).not.toContain('md:text-base');
    });

    it('handles variant classes with different modifiers', () => {
      const result = cn(
        'bg-blue-500 hover:bg-blue-600 focus:bg-blue-700',
        'bg-red-500 hover:bg-red-600'
      );
      
      expect(result).toContain('bg-red-500'); // bg-red-500 overrides bg-blue-500
      expect(result).toContain('hover:bg-red-600'); // hover:bg-red-600 overrides hover:bg-blue-600
      expect(result).toContain('focus:bg-blue-700'); // focus:bg-blue-700 remains
      expect(result).not.toContain('bg-blue-500');
      expect(result).not.toContain('hover:bg-blue-600');
    });

    it('returns empty string for no arguments', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('handles single argument', () => {
      const result = cn('single-class');
      expect(result).toBe('single-class');
    });

    it('handles mixed argument types', () => {
      const result = cn(
        'base',
        ['array1', 'array2'],
        { 'object1': true, 'object2': false },
        'string',
        undefined,
        null,
        true && 'conditional'
      );
      
      expect(result).toContain('base');
      expect(result).toContain('array1');
      expect(result).toContain('array2');
      expect(result).toContain('object1');
      expect(result).toContain('string');
      expect(result).toContain('conditional');
      expect(result).not.toContain('object2');
    });

    it('handles nested arrays', () => {
      const result = cn(['class1', ['nested1', 'nested2']], 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('nested1');
      expect(result).toContain('nested2');
      expect(result).toContain('class2');
    });

    it('handles function return values', () => {
      const getClass = (condition: boolean) => condition ? 'active' : 'inactive';
      const result = cn('base', getClass(true), getClass(false));
      
      expect(result).toContain('base');
      expect(result).toContain('active');
      expect(result).toContain('inactive');
    });
  });
});