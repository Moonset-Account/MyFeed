/** 把用户输入的“元”字符串解析为分。非法输入返回 null。 */
export function parseYuan(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [yuan, frac = ''] = trimmed.split('.');
  const cents = Number(yuan) * 100 + Number((frac + '00').slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 分 → “12.34” 元字符串 */
export function formatYuan(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const yuan = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${yuan}.${frac}`;
}
