export const divideEvenly = (total: number, count: number): { baseAmount: number; lastAmount: number } => {
  const baseAmount = Math.floor((total * 100) / count) / 100;
  const lastAmount = parseFloat((total - baseAmount * (count - 1)).toFixed(2));
  return { baseAmount, lastAmount };
};
