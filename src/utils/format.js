export function formatCurrency(amount) {
  return `$${Math.abs(amount).toFixed(2)}`
}
