// Countries with daily coverage in Carbon Monitor (flag only; no daily series is bundled).
export const DAILY = new Set('USA CHN IND RUS JPN BRA AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE GBR'.split(' '));
export const FUELS = ['Coal','Oil','Gas','Cement','Flaring','Other'];
const base = import.meta.env.BASE_URL;
export async function loadAll() {
  const [geo, em] = await Promise.all(['geo','emissions'].map(n => fetch(`${base}data/${n}.json`).then(r => r.json())));
  return geo.features.map(f => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let best = null, area = -1;
    for (const p of polys) {
      const xs = p[0].map(c => c[0]), ys = p[0].map(c => c[1]);
      const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const a = (b[2]-b[0]) * (b[3]-b[1]); if (a > area) { area = a; best = b; }
    }
    const e = em[f.properties.iso] || null;
    return { ...f.properties, polys, cen: [(best[1]+best[3])/2, (best[0]+best[2])/2], em: e,
      co2: e && last(e.co2), pc: e && last(e.pc), daily: DAILY.has(f.properties.iso) };
  });
}
export function last(a) { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return { v: a[i], year: 1900 + i }; return null; }
export const flag = c => /^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map(ch => 127397 + ch.charCodeAt())) : '';
export const fmt = (v, unit = 'Mt') => v == null ? '—' : unit === 't' ? v.toFixed(1) + ' t' : v >= 1000 ? (v/1000).toFixed(2) + ' Gt' : v.toFixed(v < 10 ? 2 : 0) + ' Mt';
const STOPS = [[36,54,92],[106,74,140],[194,69,90],[255,138,61],[255,226,154]];
export function heat(t) {
  t = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(t)), f = t - i;
  return `rgb(${STOPS[i].map((c, k) => Math.round(c + (STOPS[i+1][k] - c) * f)).join(',')})`;
}
const ring = (r, x, y) => { let s = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0]-r[i][0]) * (y-r[i][1]) / (r[j][1]-r[i][1]) + r[i][0]) s = !s;
  return s; };
export const contains = (c, lon, lat) => c.polys.some(p => ring(p[0], lon, lat) && !p.slice(1).some(h => ring(h, lon, lat)));
