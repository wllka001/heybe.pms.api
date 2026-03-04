export interface AllocationTarget {
  id: string;
  balance: number;
}

export interface AllocationResult {
  invoiceId: string;
  amount: number;
}

export function allocatePayment(
  amount: number,
  openInvoices: AllocationTarget[],
): { allocations: AllocationResult[]; unallocated: number } {
  let remaining = amount;
  const allocations: AllocationResult[] = [];

  for (const invoice of openInvoices) {
    if (remaining <= 0) {
      break;
    }

    if (invoice.balance <= 0) {
      continue;
    }

    const allocated = Math.min(remaining, invoice.balance);
    allocations.push({ invoiceId: invoice.id, amount: allocated });
    remaining -= allocated;
  }

  return { allocations, unallocated: remaining };
}
