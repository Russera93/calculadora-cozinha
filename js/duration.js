// js/duration.js — working time typed the way people say it
// ("1h30", "1:30", "45 min", "2 horas", "1,5h"; a bare number is minutes).

export function parseDuration(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(',', '.');
  if (!t) return null;

  const clock = t.match(/^(\d+):(\d{1,2})$/);
  if (clock) {
    const min = Number(clock[2]);
    return min < 60 ? Number(clock[1]) * 60 + min : null;
  }
  if (/^\d+(\.\d+)?$/.test(t)) {
    const minutos = Math.round(Number(t));
    return minutos > 0 ? minutos : null;
  }

  const m = t.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:oras?|rs?)?)?\s*(?:(\d+)\s*(?:m|min|mins|minutos?)?)?$/);
  if (!m || (m[1] == null && m[2] == null)) return null;
  // "45" alone was handled above; here a bare trailing number needs the "h" part.
  if (m[1] == null && !/m/.test(t)) return null;
  const total = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  return total > 0 ? Math.round(total) : null;
}

export function formatDuration(minutos) {
  if (!(minutos > 0)) return '';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
