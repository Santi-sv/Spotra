// SPOTRA · Edge Function: avisos de sesiones nuevas
// Nombre de la funcion: session-push
//
// Usa los mismos secretos que send-push: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen inyectados.)
//
// La llama la app apenas un rider crea una sesion:
//   POST /functions/v1/session-push   body: { "sessionId": "uuid" }
// Avisa a: quienes siguen al creador + quienes tienen la sesion dentro de su zona.
// 24/10/2026: si el creador es menor de 18, SOLO a sus seguidores aceptados (privacidad-menores.sql).
// Reglas:
//   - Solo el creador puede disparar el aviso, una sola vez, y en los 10 minutos siguientes a crearla.
//   - Nunca avisa al creador, ni a quien lo bloqueo, ni a quienes el bloqueo.
//   - Maximo 5 avisos de sesiones por persona cada 24 h y 500 destinatarios por sesion.
//   - Solo acepta llamadas desde el dominio de SPOTRA.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const ALLOWED_ORIGINS = ['https://spotra.onrender.com', 'https://spotra.online', 'https://www.spotra.online', 'https://app.spotra.online'];
const MAX_RECIPIENTS = 500;
const DAILY_CAP = 5;
const LIVE_MAX_AGE_DAYS = 14;
const BATCH = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsFor(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function json(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsFor(req), 'Content-Type': 'application/json' } });
}

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

const TXT = {
  es: { title: (p: string) => `Nueva sesión en ${p}`, body: (u: string, w: string) => `@${u} va a rodar ${w}. Tocá para sumarte.`, today: 'hoy', tomorrow: 'mañana', loc: 'es-UY' },
  pt: { title: (p: string) => `Nova sessão em ${p}`, body: (u: string, w: string) => `@${u} vai andar ${w}. Toque para entrar.`, today: 'hoje', tomorrow: 'amanhã', loc: 'pt-BR' },
  en: { title: (p: string) => `New session at ${p}`, body: (u: string, w: string) => `@${u} is riding ${w}. Tap to join.`, today: 'today', tomorrow: 'tomorrow', loc: 'en-US' },
};
type Lang = keyof typeof TXT;

function whenText(startIso: string, lang: Lang, tz: string) {
  const t = TXT[lang];
  const start = new Date(startIso);
  let zone = tz;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); } catch { zone = 'America/Montevideo'; }
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const hour = new Intl.DateTimeFormat(t.loc, { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(start);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  let label: string;
  if (day(start) === day(now)) label = t.today;
  else if (day(start) === day(tomorrow)) label = t.tomorrow;
  else label = new Intl.DateTimeFormat(t.loc, { timeZone: zone, weekday: 'long', day: 'numeric', month: 'numeric' }).format(start);
  return `${label} ${lang === 'en' ? 'at' : lang === 'pt' ? 'às' : 'a las'} ${hour}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(req) });
  if (req.method !== 'POST') return json(req, { error: 'metodo no permitido' }, 405);
  const origin = req.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json(req, { error: 'origen no permitido' }, 403);

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ---- 1) Quién llama ----
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json(req, { error: 'falta autorizacion' }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json(req, { error: 'sesion invalida' }, 401);
    const uid = userData.user.id;

    let input: Record<string, unknown> = {};
    try { input = await req.json(); } catch { return json(req, { error: 'cuerpo invalido' }, 400); }
    const sessionId = typeof input.sessionId === 'string' && UUID.test(input.sessionId) ? input.sessionId : '';
    if (!sessionId) return json(req, { error: 'sessionId invalido' }, 400);

    // ---- 2) La sesión: del que llama, reciente y sin avisar todavía ----
    const { data: s } = await admin.from('sessions')
      .select('id, place_id, created_by, username, starts_at, ends_at, created_at, notified_at')
      .eq('id', sessionId).maybeSingle();
    if (!s || s.created_by !== uid) return json(req, { error: 'sesion no encontrada' }, 404);
    if (s.notified_at) return json(req, { ok: true, sent: 0, note: 'ya avisada' });
    if (Date.now() - new Date(s.created_at).getTime() > 10 * 60000) return json(req, { error: 'sesion vieja' }, 400);
    if (new Date(s.ends_at).getTime() <= Date.now()) return json(req, { error: 'sesion terminada' }, 400);

    // marcar primero (evita dobles avisos si llaman dos veces a la vez)
    const { data: marked } = await admin.from('sessions').update({ notified_at: new Date().toISOString() })
      .eq('id', sessionId).is('notified_at', null).select('id');
    if (!marked || !marked.length) return json(req, { ok: true, sent: 0, note: 'ya avisada' });

    const { data: place } = await admin.from('places').select('name, latitude, longitude').eq('id', s.place_id).maybeSingle();
    if (!place) return json(req, { ok: true, sent: 0 });

    // ---- 3) Destinatarios ----
    const recipients = new Set<string>();
    const { data: fol } = await admin.from('follows').select('follower_id').eq('followed_id', uid).limit(2000);
    (fol ?? []).forEach((r) => recipients.add(r.follower_id));

    // 24/10/2026: si quien arma la sesión es menor, el aviso va SOLO a sus seguidores aceptados (no a riders cercanos)
    const { data: me } = await admin.from('profiles').select('birth_date').eq('id', uid).maybeSingle();
    const adultLimit = new Date(); adultLimit.setFullYear(adultLimit.getFullYear() - 18);
    const isMinor = !!(me && me.birth_date && new Date(me.birth_date + 'T00:00:00Z') > adultLimit);

    const dLat = 25 / 111;
    const dLng = 25 / (111 * Math.max(0.2, Math.cos(place.latitude * Math.PI / 180)));
    // deno-lint-ignore no-explicit-any
    let near: any[] = [];
    if (!isMinor) {
      const { data: nearData } = await admin.from('rider_locations')
        .select('profile_id, mode, latitude, longitude, radius_km, updated_at')
        .neq('mode', 'off')
        .gte('latitude', place.latitude - dLat).lte('latitude', place.latitude + dLat)
        .gte('longitude', place.longitude - dLng).lte('longitude', place.longitude + dLng)
        .limit(5000);
      near = nearData ?? [];
    }
    const liveLimit = Date.now() - LIVE_MAX_AGE_DAYS * 86400000;
    (near ?? []).forEach((r) => {
      if (r.mode === 'live' && new Date(r.updated_at).getTime() < liveLimit) return;
      if (km(place.latitude, place.longitude, r.latitude, r.longitude) <= r.radius_km) recipients.add(r.profile_id);
    });
    recipients.delete(uid);

    // bloqueos en los dos sentidos
    const { data: bl } = await admin.from('blocks').select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
    (bl ?? []).forEach((b) => { recipients.delete(b.blocker_id === uid ? b.blocked_id : b.blocker_id); });

    let ids = [...recipients];
    if (!ids.length) return json(req, { ok: true, sent: 0, recipients: 0 });

    // tope diario por persona
    const since = new Date(Date.now() - 86400000).toISOString();
    const counts = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: nt } = await admin.from('session_notifications').select('profile_id')
        .in('profile_id', ids.slice(i, i + 200)).gte('created_at', since);
      (nt ?? []).forEach((n) => counts.set(n.profile_id, (counts.get(n.profile_id) ?? 0) + 1));
    }
    ids = ids.filter((id) => (counts.get(id) ?? 0) < DAILY_CAP).slice(0, MAX_RECIPIENTS);
    if (!ids.length) return json(req, { ok: true, sent: 0, recipients: 0 });

    // ---- 4) Idioma y zona horaria de cada uno ----
    const prefs = new Map<string, { lang: Lang; tz: string }>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: pr } = await admin.from('rider_locations').select('profile_id, lang, tz').in('profile_id', ids.slice(i, i + 200));
      (pr ?? []).forEach((p) => prefs.set(p.profile_id, { lang: (['es', 'pt', 'en'].includes(p.lang) ? p.lang : 'es') as Lang, tz: p.tz || 'America/Montevideo' }));
    }

    // ---- 5) Enviar ----
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:spotra.2026@gmail.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );
    const subs: { profile_id: string; endpoint: string; p256dh: string; auth: string }[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await admin.from('push_subscriptions').select('profile_id, endpoint, p256dh, auth').in('profile_id', ids.slice(i, i + 200));
      subs.push(...(data ?? []));
    }
    const url = `/?place=${encodeURIComponent(s.place_id)}#map`;
    const placeName = String(place.name || 'SPOTRA').slice(0, 60);
    const user = String(s.username || 'rider').slice(0, 40);
    let sent = 0;
    const reached = new Set<string>();

    for (let i = 0; i < subs.length; i += BATCH) {
      const chunk = subs.slice(i, i + BATCH);
      const results = await Promise.allSettled(chunk.map((sub) => {
        const pref = prefs.get(sub.profile_id) ?? { lang: 'es' as Lang, tz: 'America/Montevideo' };
        const t = TXT[pref.lang];
        const payload = JSON.stringify({
          title: t.title(placeName).slice(0, 80),
          body: t.body(user, whenText(s.starts_at, pref.lang, pref.tz)).slice(0, 240),
          url,
          tag: 'session-' + s.id,
        });
        return webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      }));
      for (let k = 0; k < results.length; k++) {
        const r = results[k];
        if (r.status === 'fulfilled') { sent++; reached.add(chunk[k].profile_id); continue; }
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', chunk[k].endpoint);
      }
    }

    if (reached.size) {
      await admin.from('session_notifications').insert([...reached].map((pid) => ({ session_id: s.id, profile_id: pid })));
    }
    console.log('[session-push] sesion', s.id, 'destinatarios', ids.length, 'enviados', sent);
    return json(req, { ok: true, sent, recipients: ids.length });
  } catch (err) {
    console.error('[session-push] error:', err);
    return json(req, { error: 'no se pudo avisar' }, 500);
  }
});