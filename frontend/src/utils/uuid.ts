/**
 * UUID生成ユーティリティ
 */

/**
 * UUID v4を生成する
 * 
 * @returns {string} UUID v4文字列
 */
export function generateUUID(): string {
  // crypto.randomUUIDが利用可能な場合は使用
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // Secure Contextでない場合などのエラーをキャッチ
      console.warn('crypto.randomUUID failed, falling back to manual generation:', error);
    }
  }
  
  // フォールバック1: crypto.getRandomValuesを使用
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    try {
      const buffer = new Uint8Array(16);
      crypto.getRandomValues(buffer);
      
      // UUID v4の形式に変換
      buffer[6] = (buffer[6] & 0x0f) | 0x40; // version 4
      buffer[8] = (buffer[8] & 0x3f) | 0x80; // variant 10
      
      const hex = Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
      ].join('-');
    } catch (error) {
      console.warn('crypto.getRandomValues failed, falling back to Math.random:', error);
    }
  }
  
  // フォールバック2: Math.randomを使用した手動生成
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 短縮UUID（8文字）を生成する
 * 
 * @returns {string} 短縮UUID文字列
 */
export function generateShortUUID(): string {
  return generateUUID().split('-')[0];
}