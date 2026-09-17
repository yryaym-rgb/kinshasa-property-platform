/**
 * tax-calculate — computes the tax for a rent amount.
 *
 * Callers:
 *  - payment-webhook / payment-verify (internal secret) on payment success,
 *    with `persist: true` → logged as type_calcul='paiement'.
 *  - Landlord simulator (user JWT) with `simulation: true` → logged as
 *    'simulation' (audit of what-if scenarios, never creates an impôt).
 *
 * The impôt row itself is created by the pipeline (which knows the payment),
 * not here — this function is a pure calculation service.
 */

import { z } from 'zod';
import { authenticate, errorResponse, forbidden, handlePreflight, isInternalCall, json, readJson, requireMethod } from '../_shared/auth.ts';
import { serviceClient } from '../_shared/db.ts';
import { createLogger } from '../_shared/logger.ts';
import { calculateTax } from '../_shared/tax/calculator.ts';

const BodySchema = z.object({
  montantBrut: z.number().nonnegative().max(1_000_000_000),
  typeLogement: z.string().min(1).max(50),
  commune: z.string().min(1).max(100),
  typeContribuable: z.string().min(1).max(50).default('personne_physique'),
  dateTransaction: z.string().min(8).default(() => new Date().toISOString()),
  bailleurId: z.string().uuid().optional().nullable(),
  paiementId: z.string().uuid().optional().nullable(),
  contratId: z.string().uuid().optional().nullable(),
  periode: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  /** Simulation: persisted as such, never tied to a payment. */
  simulation: z.boolean().default(false),
  /** Persist to calculs_fiscaux (default true). */
  persist: z.boolean().default(true),
});

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const log = createLogger('tax-calculate', req);

  try {
    requireMethod(req, 'POST');
    const body = BodySchema.parse(await readJson(req));
    const db = serviceClient();

    let createdBy: string | null = null;
    let bailleurId = body.bailleurId ?? null;

    if (isInternalCall(req)) {
      // Trusted function-to-function call.
    } else {
      const user = await authenticate(req);
      createdBy = user.id;
      const staff = ['admin', 'agent_fiscal', 'gestionnaire', 'agence'].includes(user.role);
      // Non-staff callers may only simulate, and only for themselves.
      if (!body.simulation && !staff) throw forbidden('Seules les simulations sont autorisées');
      if (!staff) bailleurId = user.bailleurId ?? null;
      if (body.paiementId && !staff) throw forbidden();
    }

    const output = await calculateTax(
      db,
      {
        montantBrut: body.montantBrut,
        typeLogement: body.typeLogement,
        commune: body.commune,
        typeContribuable: body.typeContribuable,
        dateTransaction: body.dateTransaction,
        bailleurId: bailleurId ?? '',
        paiementId: body.paiementId ?? undefined,
        contratId: body.contratId ?? undefined,
        periode: body.periode ?? undefined,
      },
      { typeCalcul: body.simulation ? 'simulation' : 'paiement', persist: body.persist, createdBy },
    );

    log.info('tax calculated', { montantBrut: body.montantBrut, montantImpot: output.montantImpot, exonere: output.exonere, simulation: body.simulation });
    return json(req, output);
  } catch (error) {
    log.error('tax-calculate failed', error);
    return errorResponse(req, error, log.requestId);
  }
});
