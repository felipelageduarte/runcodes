import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRisky } from './plan-guard.mjs';

const rc = (type, actions) => ({ address: `${type}.x`, type, change: { actions } });

test('criar e atualizar recursos protegidos passa', () => {
  const plan = { resource_changes: [rc('aws_instance', ['create']), rc('aws_s3_bucket', ['update'])] };
  assert.deepEqual(findRisky(plan), []);
});

test('replace de instância e delete de volume são barrados', () => {
  const plan = {
    resource_changes: [rc('aws_instance', ['delete', 'create']), rc('aws_ebs_volume', ['delete'])],
  };
  assert.equal(findRisky(plan).length, 2);
});

test('delete de recurso não protegido passa', () => {
  const plan = { resource_changes: [rc('aws_ssm_parameter', ['delete']), rc('aws_cloudwatch_metric_alarm', ['delete'])] };
  assert.deepEqual(findRisky(plan), []);
});

test('plano sem resource_changes passa', () => {
  assert.deepEqual(findRisky({}), []);
});
