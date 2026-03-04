export interface InvoiceItems {
  rent: { amount: number };
  utilities: Array<{ total: number }>;
  additionalCharges: Array<{ total: number }>;
}

export function calculateInvoiceSummary(
  items: InvoiceItems,
): {
  rentSubtotal: number;
  utilitiesSubtotal: number;
  additionalSubtotal: number;
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  currency: 'USD';
} {
  const rentSubtotal = items.rent.amount;
  const utilitiesSubtotal = items.utilities.reduce(
    (sum, item) => sum + Number(item.total ?? 0),
    0,
  );
  const additionalSubtotal = items.additionalCharges.reduce(
    (sum, item) => sum + Number(item.total ?? 0),
    0,
  );

  const subtotal = rentSubtotal + utilitiesSubtotal + additionalSubtotal;

  const utilitiesTax = items.utilities.reduce((sum, item: any) => {
    return sum + Number(item.tax ?? 0);
  }, 0);
  const additionalTax = items.additionalCharges.reduce((sum, item: any) => {
    return sum + Number(item.tax ?? 0);
  }, 0);

  const taxTotal = utilitiesTax + additionalTax;

  return {
    rentSubtotal,
    utilitiesSubtotal,
    additionalSubtotal,
    subtotal,
    taxTotal,
    totalAmount: subtotal,
    currency: 'USD',
  };
}
