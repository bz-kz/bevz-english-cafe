/**
 * Class Name Utility
 * Tailwind CSSクラスを条件付きで結合するユーティリティ関数
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}