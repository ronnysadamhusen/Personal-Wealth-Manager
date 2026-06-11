// Helper to format currency in IDR (Indonesian Rupiah)
export const formatIDR = (value: number) => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absValue);
  
  return isNegative ? `-${formatted}` : formatted;
};
