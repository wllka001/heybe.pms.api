export function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function isPositive(value: number): boolean {
  return value > 0;
}
