export function normalizeCnpj(value: string) {
  return value.replace(/[./\-\s]/g, '').toUpperCase();
}
export function validCnpj(input: string) {
  const n = normalizeCnpj(input);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(n) || /^(.)\1{13}$/.test(n)) return false;
  const digit = (base: string) => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const mod = [...base].reduce((s, c, i) => s + (c.charCodeAt(0) - 48) * weights[i], 0) % 11;
    return mod < 2 ? '0' : String(11 - mod);
  };
  const first = digit(n.slice(0, 12));
  return n.slice(12) === first + digit(n.slice(0, 12) + first);
}
