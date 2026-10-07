export function formatCode(code = "") {
  return code.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3");
}
export function timeLabel(iso) {
  return iso
    ? new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
}
export function dateLabel(iso) {
  return iso
    ? new Date(iso).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}
export function initials(name = "Demo User") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
export function localDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new Error(
      "Clipboard access is unavailable. Select and copy the invite link below.",
    );
  }
}
