export function parseQuantity(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;

  // Mixed number: "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    if (den === 0) return null;
    return whole + num / den;
  }

  // Simple fraction: "1/2"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (den === 0) return null;
    return num / den;
  }

  // Plain number (integer or decimal)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return null;
}
