export function generateSequenceCode(prefix: string): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const random = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${stamp}-${random}`;
}

export function formatSequentialCode(
  prefix: string | undefined,
  length: number | undefined,
  sequence: number,
): string {
  const normalizedPrefix = (prefix ?? '').trim();
  const normalizedLength = Math.max(1, Math.trunc(length ?? 4));
  const normalizedSequence = Math.max(1, Math.trunc(sequence));
  return `${normalizedPrefix}${String(normalizedSequence).padStart(normalizedLength, '0')}`;
}

export function getNextSequentialNumber(
  codes: Array<string | null | undefined>,
  prefix: string | undefined,
): number {
  const normalizedPrefix = (prefix ?? '').trim();
  let maxSequence = 0;

  for (const code of codes) {
    if (!code) {
      continue;
    }

    if (normalizedPrefix && !code.startsWith(normalizedPrefix)) {
      continue;
    }

    const numericPart = normalizedPrefix ? code.slice(normalizedPrefix.length) : code;
    if (!/^\d+$/.test(numericPart)) {
      continue;
    }

    const parsed = Number.parseInt(numericPart, 10);
    if (parsed > maxSequence) {
      maxSequence = parsed;
    }
  }

  return maxSequence + 1;
}
