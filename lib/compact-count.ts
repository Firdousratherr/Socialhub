export function compactCount(value: number | null | undefined): string {
  const count = Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));

  if (count < 1_000) return String(count);

  const formatUnit = (unit: number, suffix: string) => {
    const scaled = count / unit;
    const rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return text + suffix;
  };

  if (count < 1_000_000) return formatUnit(1_000, "K");
  if (count < 1_000_000_000) return formatUnit(1_000_000, "M");
  return formatUnit(1_000_000_000, "B");
}

export function fullCount(value: number | null | undefined): string {
  const count = Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
  return count.toLocaleString("en-US");
}
