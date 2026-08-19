// Last installment absorbs any rounding remainder from integer division.
// e.g. divideEvenly(10000, 3) → { baseAmount: 3333.33, lastAmount: 3333.34 }
// This is intentional: concentrating the ±1 cent in the final payment is
// standard receivables practice and simplifies period reconciliation.
export const divideEvenly = (total: number, count: number): { baseAmount: number; lastAmount: number } => {
  const baseAmount = Math.floor((total * 100) / count) / 100;
  const lastAmount = parseFloat((total - baseAmount * (count - 1)).toFixed(2));
  return { baseAmount, lastAmount };
};
