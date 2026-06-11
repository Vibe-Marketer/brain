/**
 * 14-01 live probe: ticket-approval gating (401/403/409) WITHOUT writing any
 * approval/rejection event to live ticket_events. Cleans up its probe user.
 * Run: npx tsx scripts/qa/probe-ticket-approval.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmail = process.env.CALLVAULTAI_LOGIN!;
const adminPassword = process.env.CALLVAULTAI_LOGIN_PASSWORD!;
const fnUrl = `${url}/functions/v1/ticket-approval`;

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function call(token: string | null, body: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: anonKey };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(fnUrl, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.text() };
}

async function eventCount() {
  const { count, error } = await admin
    .from('ticket_events')
    .select('id', { count: 'exact', head: true })
    .in('event_type', ['approval', 'rejection']);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const before = await eventCount();
  console.log(`baseline approval/rejection event count: ${before}`);

  // Probe 1: no auth -> 401
  const p1 = await call(null, { ticket_id: '00000000-0000-0000-0000-000000000000', action: 'approve' });
  console.log(`PROBE 401 (no auth): status=${p1.status} body=${p1.body.slice(0, 120)}`);

  // Probe 2: non-admin -> 403 (disposable user)
  // @callvault.test domain → sweepable by cleanup_test_fixture_users RPC if
  // direct deleteUser is blocked by protective triggers.
  const probeEmail = `probe-14-01-${Date.now()}@callvault.test`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: probeEmail,
    password: 'Probe14-01!xyz',
    email_confirm: true,
  });
  if (createErr) throw createErr;
  const probeId = created.user!.id;
  let p2 = { status: 0, body: '' };
  try {
    const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: probeEmail,
      password: 'Probe14-01!xyz',
    });
    if (signInErr) throw signInErr;
    p2 = await call(signIn.session!.access_token, {
      ticket_id: '00000000-0000-0000-0000-000000000000',
      action: 'approve',
    });
    console.log(`PROBE 403 (non-admin): status=${p2.status} body=${p2.body.slice(0, 120)}`);
  } finally {
    const { error: delErr } = await admin.auth.admin.deleteUser(probeId);
    console.log(`probe user deleted: ${delErr ? 'FAILED ' + delErr.message : 'ok'}`);
  }

  // Probe 3: admin on a ticket NOT awaiting_approval -> 409
  const anonClient2 = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: adminSignIn, error: adminErr } = await anonClient2.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (adminErr) throw adminErr;
  const { data: tickets, error: tErr } = await admin
    .from('tickets')
    .select('id, status')
    .neq('status', 'awaiting_approval')
    .limit(1);
  if (tErr) throw tErr;
  if (!tickets?.length) throw new Error('no non-awaiting ticket found for 409 probe');
  const p3 = await call(adminSignIn.session!.access_token, {
    ticket_id: tickets[0].id,
    action: 'approve',
  });
  console.log(
    `PROBE 409 (admin, ticket status=${tickets[0].status}): status=${p3.status} body=${p3.body.slice(0, 160)}`,
  );

  // Residue checks
  const after = await eventCount();
  console.log(`post-probe approval/rejection event count: ${after} (delta=${after - before})`);
  const { count: residue } = await admin
    .from('ticket_events')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', probeId);
  console.log(`probe-user residue rows in ticket_events: ${residue ?? 0}`);

  const pass = p1.status === 401 && p2.status === 403 && p3.status === 409 && after === before;
  console.log(pass ? 'ALL PROBES PASS' : 'PROBE FAILURE');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('probe error:', e);
  process.exit(1);
});
