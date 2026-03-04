export function calculateLateFee(
  balance: number,
  lateFeeType: 'fixed' | 'percentage',
  lateFeeValue: number,
): number {
  if (balance <= 0 || lateFeeValue <= 0) {
    return 0;
  }

  if (lateFeeType === 'fixed') {
    return Number(lateFeeValue.toFixed(2));
  }

  return Number(((balance * lateFeeValue) / 100).toFixed(2));
}
