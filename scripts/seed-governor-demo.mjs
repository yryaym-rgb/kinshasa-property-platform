#!/usr/bin/env node
/**
 * Governor demo dataset for eLoyer Kinshasa (remote Supabase).
 *
 * Targets: 20 landlords, 50 properties, 80 contracts, 300 succeeded payments (12 months),
 * tax records, compliance scores across green/yellow/orange/red.
 *
 * Requires service role (never commit):
 *   SUPABASE_URL=https://moxfwfxmdctkvjbfvxgx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Usage: node scripts/seed-governor-demo.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const COMMUNES = [
  'Gombe', 'Lingwala', 'Kinshasa', 'Kalamu', 'Bandalungwa', 'Barumbu', 'Lemba', 'Limete',
  'Matete', 'Ngiri-Ngiri', 'Makala', 'Selembao', 'Bumbu', 'Mont-Ngafula', 'Ndjili',
  'Kimbanseke', 'Kisenso', 'Masina', 'Nsele', 'Ngaliema',
];
const TYPES = ['Appartement', 'Studio', 'Villa', 'Bureau', 'Magasin'];
const PROVIDERS = ['orange_money', 'mpesa', 'airtel_money'];

function pick(arr, i) {
  return arr[i % arr.length];
}

function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  const { data: communeRows } = await db.from('communes').select('name');
  const communes = communeRows?.map((c) => c.name) ?? COMMUNES;

  console.log(`Governor demo seed ${dryRun ? '(dry-run)' : ''} → ${url}`);

  const stats = {
    landlords: 0,
    properties: 0,
    contracts: 0,
    payments: 0,
    impots: 0,
  };

  for (let i = 0; i < 20; i++) {
    const email = `demo.bailleur.${i + 1}@eloyer-demo.local`;
    const phone = `+2438${String(10000000 + i).slice(-8)}`;
    const commune = pick(communes, i);
    const complianceTarget = i % 4; // 0=excellent, 1=good, 2=warning, 3=critical

    if (dryRun) {
      stats.landlords++;
      stats.properties += i % 3 === 0 ? 4 : 2;
      stats.contracts += 4;
      stats.payments += 15;
      continue;
    }

    const { data: authUser, error: authErr } = await db.auth.admin.createUser({
      email,
      phone,
      password: `Demo-${i + 1}-Governor!`,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { full_name: `Bailleur Démo ${i + 1}` },
    });
    if (authErr) throw authErr;

    const userId = authUser.user.id;
    await db.from('users').upsert({
      id: userId,
      role: 'bailleur',
      phone,
      email,
      full_name: `Bailleur Démo ${i + 1}`,
      commune,
      kyc_status: complianceTarget === 0 ? 'verified' : complianceTarget === 1 ? 'submitted' : 'pending',
      is_active: true,
    });

    const { data: bailleur, error: bErr } = await db
      .from('bailleurs')
      .insert({
        user_id: userId,
        business_name: `Portfolio ${commune} ${i + 1}`,
        tax_id: `NIF-DEMO-${1000 + i}`,
        compliance_score: [92, 78, 55, 32][complianceTarget],
        compliance_level: ['excellent', 'good', 'warning', 'critical'][complianceTarget],
      })
      .select('id')
      .single();
    if (bErr) throw bErr;
    stats.landlords++;

    const propCount = i % 3 === 0 ? 4 : 2;
    const logementIds = [];
    for (let p = 0; p < propCount; p++) {
      const loyer = 120_000 + (i * 17_000) + p * 25_000;
      const { data: logement, error: lErr } = await db
        .from('logements')
        .insert({
          bailleur_id: bailleur.id,
          type: pick(TYPES, i + p),
          commune: pick(communes, i + p),
          address: `${10 + p} Av. Démo, ${commune}`,
          avenue: String(10 + p),
          parcelle: String(100 + p),
          loyer_mensuel: loyer,
          status: p === 0 ? 'occupe' : 'disponible',
          is_occupied: p === 0,
        })
        .select('id, loyer_mensuel, type, commune')
        .single();
      if (lErr) throw lErr;
      logementIds.push(logement);
      stats.properties++;
    }

    for (let c = 0; c < 4; c++) {
      const locEmail = `demo.locataire.${i}.${c}@eloyer-demo.local`;
      const { data: locAuth, error: locAuthErr } = await db.auth.admin.createUser({
        email: locEmail,
        phone: `+2439${String(20000000 + i * 10 + c).slice(-8)}`,
        password: `Demo-loc-${i}-${c}!`,
        email_confirm: true,
        user_metadata: { full_name: `Locataire ${i + 1}.${c + 1}` },
      });
      if (locAuthErr) throw locAuthErr;
      const locId = locAuth.user.id;
      await db.from('users').upsert({
        id: locId,
        role: 'locataire',
        email: locEmail,
        full_name: `Locataire ${i + 1}.${c + 1}`,
        commune,
        is_active: true,
      });

      const logement = logementIds[c % logementIds.length];
      const { data: contrat, error: cErr } = await db
        .from('contrats')
        .insert({
          bailleur_id: bailleur.id,
          logement_id: logement.id,
          locataire_id: locId,
          loyer_mensuel: logement.loyer_mensuel,
          status: c === 0 ? 'actif' : 'actif',
          date_debut: '2024-06-01',
          date_fin: '2026-12-31',
        })
        .select('id, loyer_mensuel')
        .single();
      if (cErr) throw cErr;
      stats.contracts++;

      const paymentsForContract = c === 0 ? 4 : 2;
      for (let m = 0; m < paymentsForContract; m++) {
        const paidAt = new Date();
        paidAt.setUTCMonth(paidAt.getUTCMonth() - m);
        paidAt.setUTCDate(5);
        const periode = monthKey(paidAt);
        const montant = Number(contrat.loyer_mensuel);
        const provider = pick(PROVIDERS, i + m + c);
        const taxRate = logement.type === 'Appartement' || logement.type === 'Studio' || logement.type === 'Villa' ? 0.1 : 0.15;
        const impot = Math.round(montant * taxRate * 100) / 100;
        const loyerNet = montant - impot;

        const { data: paiement, error: pErr } = await db
          .from('paiements')
          .insert({
            contrat_id: contrat.id,
            montant,
            currency: 'CDF',
            method: provider === 'orange_money' ? 'Orange Money' : provider === 'mpesa' ? 'M-Pesa' : 'Airtel Money',
            state: 'succeeded',
            provider,
            provider_transaction_id: `${provider.toUpperCase()}-DEMO-${i}-${c}-${m}`,
            periode,
            paid_at: paidAt.toISOString(),
            pipeline: { tax: { status: 'done' }, ledger: { status: 'done' }, receipt: { status: 'done' }, notifications: { status: 'done' } },
          })
          .select('id')
          .single();
        if (pErr) throw pErr;
        stats.payments++;

        await db.from('impots').insert({
          contrat_id: contrat.id,
          paiement_id: paiement.id,
          bailleur_id: bailleur.id,
          periode,
          montant: impot,
          taux: taxRate,
          base_imposable: montant,
          commune: logement.commune,
          type_logement: logement.type,
          status: m === 0 ? 'declare' : 'paye',
          calculated_at: paidAt.toISOString(),
        });
        stats.impots++;

        await db.from('ledger_entries').insert([
          { paiement_id: paiement.id, account_type: 'bailleur', account_id: bailleur.id, direction: 'credit', amount: loyerNet, description: 'Loyer net' },
          { paiement_id: paiement.id, account_type: 'dgi', direction: 'debit', amount: impot, description: 'Impôt retenu' },
        ]);
      }
    }
  }

  // Fiscal agent for dashboard login
  if (!dryRun) {
    const agentEmail = 'demo.agent.fiscal@eloyer-demo.local';
    const { data: existing } = await db.from('users').select('id').eq('email', agentEmail).maybeSingle();
    if (!existing) {
      const { data: agentAuth, error: aErr } = await db.auth.admin.createUser({
        email: agentEmail,
        password: 'Demo-Agent-Fiscal!',
        email_confirm: true,
        user_metadata: { full_name: 'Agent Fiscal Démo' },
      });
      if (aErr) throw aErr;
      await db.from('users').upsert({
        id: agentAuth.user.id,
        role: 'agent_fiscal',
        email: agentEmail,
        full_name: 'Agent Fiscal Démo',
        commune: 'Gombe',
        kyc_status: 'verified',
        is_active: true,
      });
    }
  }

  console.log(JSON.stringify(stats, null, 2));
  if (dryRun) console.log('Re-run without --dry-run after setting SUPABASE_SERVICE_ROLE_KEY.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
