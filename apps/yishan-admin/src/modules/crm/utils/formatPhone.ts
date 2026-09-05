/** Display formatting only; preserve nonstandard and already-masked numbers. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return /^\d{11}$/.test(phone)
    ? `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`
    : phone;
}
