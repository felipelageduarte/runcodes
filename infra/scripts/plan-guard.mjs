#!/usr/bin/env node
// Trava do deploy automático (mesmo desenho do emboabaDuarte). O merge na main
// aplica com AdministratorAccess e sem aprovação humana; esta trava recusa, em
// CI, plano que destrua ou recrie o host, os dados, a rede, a borda ou o IAM.
// Passa com ALLOW_DESTRUCTIVE=true (workflow_dispatch com allow_destructive).
//
// Uso: terraform show -json tfplan | node infra/scripts/plan-guard.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PROTECTED_TYPES = new Set([
  'aws_instance', 'aws_ebs_volume', 'aws_volume_attachment', 'aws_eip',
  'aws_vpc', 'aws_subnet', 'aws_security_group', 'aws_route_table', 'aws_internet_gateway',
  'aws_cloudfront_distribution',
  'aws_s3_bucket', 'aws_dynamodb_table',
  'aws_iam_role', 'aws_iam_openid_connect_provider',
]);

/** Devolve as mudanças que destroem ou recriam recursos protegidos. */
export function findRisky(plan) {
  const risky = [];
  for (const rc of plan.resource_changes || []) {
    const actions = rc.change?.actions || [];
    if (!actions.includes('delete')) continue; // delete puro ou replace (delete+create)
    if (PROTECTED_TYPES.has(rc.type)) {
      risky.push({ address: rc.address, actions: actions.join('+') });
    }
  }
  return risky;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = JSON.parse(readFileSync(0, 'utf8'));
  const risky = findRisky(plan);
  if (!risky.length) {
    console.log('plan-guard: nenhuma destruição de recurso protegido.');
    process.exit(0);
  }
  console.error('plan-guard: o plano destrói ou recria recursos protegidos:');
  for (const r of risky) console.error(`  - ${r.address} (${r.actions})`);
  if (process.env.ALLOW_DESTRUCTIVE === 'true') {
    console.error('plan-guard: ALLOW_DESTRUCTIVE=true, seguindo por decisão explícita.');
    process.exit(0);
  }
  console.error('plan-guard: abortado. Revise o plano e rode o workflow manualmente com allow_destructive=true.');
  process.exit(1);
}
