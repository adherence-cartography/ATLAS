/**
 * ATLAS — DynamoDB table provisioning script
 * Region: me-central-1 (Abu Dhabi, UAE) — PDPL data residency
 *
 * Run once:
 *   node create-dynamo-tables.mjs
 *
 * Requires env vars:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   (AWS_REGION defaults to me-central-1 below)
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'me-central-1' });

// ── Helper ────────────────────────────────────────────────────────────────────
async function createTable(params) {
  const name = params.TableName;
  try {
    // Check if already exists
    try {
      await client.send(new DescribeTableCommand({ TableName: name }));
      console.log(`  ✓ ${name} — already exists, skipping`);
      return;
    } catch (e) {
      if (e.name !== 'ResourceNotFoundException') throw e;
    }

    await client.send(new CreateTableCommand(params));
    console.log(`  ✓ ${name} — created`);
  } catch (e) {
    if (e.name === 'ResourceInUseException') {
      console.log(`  ✓ ${name} — already exists`);
    } else {
      console.error(`  ✗ ${name} — FAILED:`, e.message);
      process.exitCode = 1;
    }
  }
}

// ── Table definitions ─────────────────────────────────────────────────────────

// 1. atlas-assessments
//    Stores every MAP/MMAS-8 assessment submission.
//    PK: workspace_key   (which workspace submitted it)
//    SK: record_id       (ts#uuid — sorts chronologically per workspace)
//    GSI: patient_number-ts-index — lets dashboard query one patient's history
const assessments = {
  TableName: 'atlas-assessments',
  BillingMode: 'PAY_PER_REQUEST',
  TableClass: 'STANDARD',
  AttributeDefinitions: [
    { AttributeName: 'workspace_key', AttributeType: 'S' },
    { AttributeName: 'record_id',     AttributeType: 'S' },
    { AttributeName: 'patient_number',AttributeType: 'S' },
    { AttributeName: 'ts',            AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'workspace_key', KeyType: 'HASH'  },
    { AttributeName: 'record_id',     KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'patient_number-ts-index',
      KeySchema: [
        { AttributeName: 'patient_number', KeyType: 'HASH'  },
        { AttributeName: 'ts',             KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
};

// 2. atlas-peacs
//    Stores every PEACS assessment submission (full PE scores + dimension sources).
//    Identical key pattern to atlas-assessments.
const peacs = {
  TableName: 'atlas-peacs',
  BillingMode: 'PAY_PER_REQUEST',
  TableClass: 'STANDARD',
  AttributeDefinitions: [
    { AttributeName: 'workspace_key', AttributeType: 'S' },
    { AttributeName: 'record_id',     AttributeType: 'S' },
    { AttributeName: 'patient_number',AttributeType: 'S' },
    { AttributeName: 'ts',            AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'workspace_key', KeyType: 'HASH'  },
    { AttributeName: 'record_id',     KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'patient_number-ts-index',
      KeySchema: [
        { AttributeName: 'patient_number', KeyType: 'HASH'  },
        { AttributeName: 'ts',             KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
};

// 3. atlas-peacs-dim
//    Stores the CURRENT dimension scores (base/mvmt/strata) per patient.
//    One row per patient+dimension — SET semantics (overwritten on each KYBOS submit).
//    PK: ws_patient  (format: "WORKSPACE#PATIENT_ID")
//    SK: dimension   ("base" | "mvmt" | "strata")
const peacsDim = {
  TableName: 'atlas-peacs-dim',
  BillingMode: 'PAY_PER_REQUEST',
  TableClass: 'STANDARD',
  AttributeDefinitions: [
    { AttributeName: 'ws_patient', AttributeType: 'S' },
    { AttributeName: 'dimension',  AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'ws_patient', KeyType: 'HASH'  },
    { AttributeName: 'dimension',  KeyType: 'RANGE' },
  ],
};

// 4. atlas-audit
//    Immutable audit trail — all admin/clinician actions.
//    PK: workspace_key   (partition by workspace for fast PI queries)
//    SK: ts_id           (ISO timestamp + uuid — chronological, unique)
//    TTL: ttl_epoch      (epoch seconds; records auto-deleted after 90 days)
const audit = {
  TableName: 'atlas-audit',
  BillingMode: 'PAY_PER_REQUEST',
  TableClass: 'STANDARD',
  AttributeDefinitions: [
    { AttributeName: 'workspace_key', AttributeType: 'S' },
    { AttributeName: 'ts_id',         AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'workspace_key', KeyType: 'HASH'  },
    { AttributeName: 'ts_id',         KeyType: 'RANGE' },
  ],
  // TTL must be enabled via UpdateTimeToLive after table creation (done below)
};

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\nProvisioning ATLAS DynamoDB tables in me-central-1 (Abu Dhabi, UAE)...\n');

await createTable(assessments);
await createTable(peacs);
await createTable(peacsDim);
await createTable(audit);

// Enable TTL on atlas-audit (idempotent — no-ops if already enabled)
try {
  const { UpdateTimeToLiveCommand } = await import('@aws-sdk/client-dynamodb');
  await client.send(new UpdateTimeToLiveCommand({
    TableName: 'atlas-audit',
    TimeToLiveSpecification: {
      Enabled:       true,
      AttributeName: 'ttl_epoch',
    },
  }));
  console.log('  ✓ atlas-audit TTL enabled on ttl_epoch');
} catch (e) {
  if (e.message?.includes('TimeToLive is already enabled')) {
    console.log('  ✓ atlas-audit TTL already enabled');
  } else {
    console.warn('  ⚠ atlas-audit TTL:', e.message);
  }
}

console.log('\nDone. Tables will be ACTIVE within ~30 seconds.\n');
console.log('Next step: deploy the updated lambda/index.mjs (the /db route).\n');
