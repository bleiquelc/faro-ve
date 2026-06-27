import type { RequestHandler } from './$types';

/**
 * GET /api/pfif — feed de federación PFIF 1.4 (http://zesty.ca/pfif/1.4/).
 *
 * Misión: que Cruz Roja / ICRC / Google Person Finder puedan INGERIR los
 * reportes públicos de Faro VE (más ojos = más posibilidad de hallazgo).
 *
 * PRIVACIDAD (por construcción): lee SOLO de persons_public (coords ofuscadas,
 * sin PII, solo approved + no-withdrawn, foto de menor ya NULL). El feed:
 *  - NO incluye coordenadas (la ubicación va en TEXTO, jamás lat/lng).
 *  - NO incluye dato alguno del reportante (email/phone) — la vista no los expone.
 *  - Foto: solo si NO es menor (defensa en profundidad; la vista ya la NULL-ea, #3).
 *  - Campos PFIF estándar SIN modificar (regla #11). Cada record lleva su
 *    source + source_url (atribución #9). El opt-out purga la fila → sale del feed.
 *
 * Paginado: ?limit (máx 200, default 200) & ?offset. Cache 5 min. noindex.
 */

const PFIF_NS = 'http://zesty.ca/pfif/1.4/';
const SITE = 'faro-ve.com';
const MAX_LIMIT = 200;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name: string, value: unknown, indent = '    '): string {
  if (value === null || value === undefined || value === '') return '';
  return `${indent}<pfif:${name}>${xmlEscape(String(value))}</pfif:${name}>\n`;
}

// status interno → status PFIF 1.4 (en la nota).
function pfifStatus(status: string): string | null {
  switch (status) {
    case 'missing':
      return 'believed_missing';
    case 'found_alive':
    case 'safe_self_report':
    case 'safe':
      return 'believed_alive';
    case 'unidentified_body':
    case 'deceased':
      return 'believed_dead';
    default:
      return null;
  }
}

// PFIF 1.4 sex: male | female | other. unknown → se omite (es opcional).
function pfifSex(sex: unknown): string | null {
  return sex === 'male' || sex === 'female' ? sex : null;
}

interface Row {
  id: string;
  pfif_id: string | null;
  source: string | null;
  source_url: string | null;
  given_name: string | null;
  family_name: string | null;
  full_name: string | null;
  sex: string | null;
  age: number | null;
  home_neighborhood: string | null;
  home_city: string | null;
  last_known_location_text: string | null;
  description: string | null;
  photo_url: string | null;
  status: string;
  is_minor: boolean | null;
  created_at: string | null;
}

export const GET: RequestHandler = async ({ url, locals, setHeaders }) => {
  if (!locals.supabase) {
    return new Response('<?xml version="1.0"?><error>service_unavailable</error>', {
      status: 503,
      headers: { 'content-type': 'application/xml; charset=utf-8' }
    });
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '200', 10) || 200)
  );
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);

  const { data, error: dbError } = await locals.supabase
    .from('persons_public')
    .select(
      'id, pfif_id, source, source_url, given_name, family_name, full_name, sex, age, ' +
        'home_neighborhood, home_city, last_known_location_text, description, photo_url, ' +
        'status, is_minor, created_at'
    )
    // (Federación: SIN filtro de coords. PFIF lleva la ubicación en TEXTO, no
    // lat/lon; filtrar por coords dejaría fuera del feed a quien reportó sin GPS
    // —común con el GPS fallando en el sismo— y debe poder federarse igual.)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbError) {
    console.error('[GET /api/pfif]', dbError.message);
    return new Response('<?xml version="1.0"?><error>db_error</error>', {
      status: 502,
      headers: { 'content-type': 'application/xml; charset=utf-8' }
    });
  }

  const rows = (data ?? []) as unknown as Row[];
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>\n');
  out.push(`<!-- Faro VE — feed de federación PFIF 1.4. Datos públicos ofuscados, sin PII.\n`);
  out.push(`     Atribución obligatoria + opt-out: opt-out@faro-ve.com (SLA 24h).\n`);
  out.push(`     Página: offset=${offset} limit=${limit} devueltos=${rows.length}.\n`);
  out.push(`     Siguiente página: ?offset=${offset + rows.length}&limit=${limit} -->\n`);
  out.push(`<pfif:pfif xmlns:pfif="${PFIF_NS}">\n`);

  for (const p of rows) {
    // pfif_id ya es un record id PFIF completo (dominio/uuid); si falta, lo armamos.
    const recId = p.pfif_id ?? `${SITE}/${p.id}`;
    const entry = p.created_at ?? '';
    // expiry_date = entrada + 60d (retención Habeas Data VE, #6). Le dice a CADA
    // partner que ingiere el feed cuándo DEBE purgar el record (PFIF 1.4) → el
    // opt-out / borrado se propaga aguas abajo y la data no sobrevive más allá
    // de lo que la ley permite.
    const expiry = entry
      ? new Date(new Date(entry).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
      : '';
    const fullName = p.full_name ?? [p.given_name, p.family_name].filter(Boolean).join(' ').trim();

    out.push('  <pfif:person>\n');
    out.push(tag('person_record_id', recId));
    out.push(tag('entry_date', entry));
    out.push(tag('expiry_date', expiry));
    out.push(tag('author_name', 'Faro VE'));
    out.push(tag('source_name', p.source ?? 'faro-ve'));
    out.push(tag('source_url', p.source_url ?? `https://${SITE}/persona/${p.id}`));
    out.push(tag('source_date', entry));
    out.push(tag('full_name', fullName));
    out.push(tag('given_name', p.given_name));
    out.push(tag('family_name', p.family_name));
    out.push(tag('sex', pfifSex(p.sex)));
    if (p.age != null) out.push(tag('age', p.age));
    out.push(tag('home_city', p.home_city));
    out.push(tag('home_neighborhood', p.home_neighborhood));
    // Foto SOLO si no es menor (la vista ya la enmascara; doble candado #3).
    if (!p.is_minor && p.photo_url) out.push(tag('photo_url', p.photo_url));
    out.push(tag('description', p.description));

    // Nota: estado + ubicación en TEXTO (jamás coordenadas).
    const st = pfifStatus(p.status);
    const loc = p.last_known_location_text ?? p.home_city ?? '';
    if (st || loc) {
      out.push('    <pfif:note>\n');
      out.push(tag('note_record_id', `${recId}/n0`, '      '));
      out.push(tag('person_record_id', recId, '      '));
      out.push(tag('source_date', entry, '      '));
      out.push(tag('status', st, '      '));
      out.push(tag('last_known_location', loc, '      '));
      out.push('    </pfif:note>\n');
    }
    out.push('  </pfif:person>\n');
  }

  out.push('</pfif:pfif>\n');

  setHeaders({
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=300, s-maxage=300',
    'x-robots-tag': 'noindex'
  });
  return new Response(out.join(''));
};
