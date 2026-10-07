#!/usr/bin/env node
/**
 * Explicit, local-only repair guard for the 2026-10-07 CRM demo duplicate.
 *
 * The default mode is a read-only dry run.  This intentionally names the
 * candidate rows rather than grouping by a title: the audit found that
 * opportunity 2 / quotation 3 were created by the acceptance run, while
 * opportunity 1 / quotations 1+4 contain the real business timeline.
 *
 * `--apply` archives only the duplicate opportunity after moving its complete
 * quote series to the canonical opportunity. Published quotes, items, shares,
 * status logs and activity rows are preserved. A quote with share history is
 * deliberately kept as its own series, even when it is an acceptance fixture.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const CANONICAL_OPPORTUNITY_ID = 1;
const DUPLICATE_OPPORTUNITY_ID = 2;
const REAL_QUOTE_IDS = [1, 4];
const TEST_QUOTE_ID = 3;
const CUSTOMER_ID = 23;

const argv = new Set(process.argv.slice(2));
const apply = argv.has('--apply');
const host = process.env.DATABASE_HOST ?? '127.0.0.1';
const database = process.env.DATABASE_NAME ?? 'yishan';
const port = Number(process.env.DATABASE_PORT ?? 3306);
const user = process.env.DATABASE_USER ?? 'root';
const password = process.env.DATABASE_PASSWORD ?? 'dev-root-only-do-not-use-in-prod';

const pool = await mysql.createPool({ host, port, user, password, database, charset: 'utf8mb4' });
const q = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

const opportunities = await q(
  `SELECT id,name,customer_id,primary_contact_id,owner_id,owner_department_id,stage,
          amount_cents,expected_close_date,created_at,updated_at,deleted_at
     FROM crm_opportunity
    WHERE id IN (?,?) AND customer_id = ? ORDER BY id`,
  [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID, CUSTOMER_ID],
);
const quotations = await q(
  `SELECT id,quotation_no,name,version,root_quote_id,source_quote_id,customer_id,
          opportunity_id,owner_user_id,status,quote_date,valid_until,net_cents,
          tax_cents,discount_amount_cents,total_cents,created_at,updated_at,deleted_at
     FROM crm_quotation WHERE id IN (?,?,?) ORDER BY id`,
  [REAL_QUOTE_IDS[0], TEST_QUOTE_ID, REAL_QUOTE_IDS[1]],
);
const items = await q(
  `SELECT id,quotation_id,product_id,product_name_snapshot,description,unit_snapshot,
          quantity_cents,unit_price_cents,discount_bp,tax_rate_bp,line_amount_cents,
          sort_order,created_at,updated_at
     FROM crm_quotation_item WHERE quotation_id IN (?,?,?) ORDER BY quotation_id,sort_order,id`,
  [REAL_QUOTE_IDS[0], TEST_QUOTE_ID, REAL_QUOTE_IDS[1]],
);
// Never select token_hash: it is credential material even in a local dump.
const shares = await q(
  `SELECT id,quotation_id,status,expires_at,duration_days,
          follow_quote_valid_until,created_at,created_by,sent_at,first_viewed_at,
          last_viewed_at,view_count,revoked_at,updated_at
     FROM crm_quotation_share WHERE quotation_id IN (?,?,?) ORDER BY quotation_id,id`,
  [REAL_QUOTE_IDS[0], TEST_QUOTE_ID, REAL_QUOTE_IDS[1]],
);
const activities = await q(
  `SELECT id,customer_id,contact_id,type,content,occurred_at,next_follow_up_at,result,
          next_follow_up_plan,operator_user_id,created_at,updated_at,deleted_at,
          entity_type,entity_id,entity_ref_type,metadata,category
     FROM crm_activity
    WHERE customer_id = ?
      AND ((entity_type = 'opportunity' AND entity_id IN (?,?))
           OR JSON_EXTRACT(metadata,'$.opportunityId') IN (?,?)
           OR JSON_EXTRACT(metadata,'$.quotationId') IN (?,?,?))
    ORDER BY occurred_at,id`,
  [CUSTOMER_ID, CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID,
   CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID,
   REAL_QUOTE_IDS[0], TEST_QUOTE_ID, REAL_QUOTE_IDS[1]],
);
const stageLogs = await q(
  `SELECT id,opportunity_id,from_stage,to_stage,operator_user_id,reason,created_at
     FROM crm_opportunity_stage_log WHERE opportunity_id IN (?,?) ORDER BY opportunity_id,created_at,id`,
  [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
);
const contracts = await q(
  `SELECT id,contract_no,customer_id,opportunity_id,quotation_id,status,amount_cents,deleted_at
     FROM crm_contract WHERE customer_id = ? AND (opportunity_id IN (?,?) OR quotation_id IN (?,?,?))`,
  [CUSTOMER_ID, CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID,
   REAL_QUOTE_IDS[0], TEST_QUOTE_ID, REAL_QUOTE_IDS[1]],
);
const payments = await q(
  `SELECT id,payment_no,contract_id,customer_id,amount_cents,paid_at,status,deleted_at
     FROM crm_payment WHERE customer_id = ?`,
  [CUSTOMER_ID],
);
const directCloses = await q(
  `SELECT id,customer_id,opportunity_id,amount_cents,closed_at,evidence_type,revoked_at
     FROM crm_direct_close WHERE customer_id = ? AND opportunity_id IN (?,?)`,
  [CUSTOMER_ID, CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
);
const intents = await q(
  `SELECT id,opportunity_id,product_id,created_at
     FROM crm_opportunity_product_intent WHERE opportunity_id IN (?,?)`,
  [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
);
const seriesTables = await q(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'crm_quotation_series'`,
);
const series = seriesTables.length
  ? await q(`SELECT id,series_no,title,customer_id,opportunity_id
               FROM crm_quotation_series WHERE opportunity_id IN (?,?) ORDER BY series_no`,
      [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID])
  : [];
const activityMetadata = (row) => {
  if (!row.metadata) return null;
  if (typeof row.metadata === 'object') return row.metadata;
  try { return JSON.parse(row.metadata); } catch { return null; }
};

const summary = {
  mode: apply ? 'apply-requested' : 'dry-run',
  customerId: CUSTOMER_ID,
  canonicalOpportunityId: CANONICAL_OPPORTUNITY_ID,
  duplicateOpportunityId: DUPLICATE_OPPORTUNITY_ID,
  realQuoteIds: REAL_QUOTE_IDS,
  testQuoteId: TEST_QUOTE_ID,
  counts: {
    opportunities: opportunities.length,
    quotations: quotations.length,
    items: items.length,
    shares: shares.length,
    activities: activities.length,
    stageLogs: stageLogs.length,
    contracts: contracts.length,
    payments: payments.length,
    directCloses: directCloses.length,
    productIntents: intents.length,
    series: series.length,
  },
  quotationIdsToReassociate: quotations.filter((row) => row.opportunity_id === DUPLICATE_OPPORTUNITY_ID).map((row) => row.id),
  seriesIdsToReassociate: series.filter((row) => row.opportunity_id === DUPLICATE_OPPORTUNITY_ID).map((row) => row.id),
  activityIdsToReassociate: activities.filter((row) => activityMetadata(row)?.opportunityId === DUPLICATE_OPPORTUNITY_ID
    || (row.entity_type === 'opportunity' && row.entity_id === DUPLICATE_OPPORTUNITY_ID)).map((row) => row.id),
  preservedTestQuotationReason: shares.some((row) => row.quotation_id === TEST_QUOTE_ID)
    ? 'quotation 3 has share history; keep it and its independent series, items, shares and activities'
    : null,
  conflicts: [
    ...(contracts.length ? ['contract references exist'] : []),
    ...(payments.length ? ['customer payment references exist'] : []),
    ...(directCloses.length ? ['direct close references exist'] : []),
  ],
};
console.log(JSON.stringify({ summary, opportunities, quotations, series, items, shares, activities, stageLogs, contracts, payments, directCloses, intents }, null, 2));

if (!apply) {
  await pool.end();
  process.exit(0);
}

if (!['localhost', '127.0.0.1', '::1'].includes(host) || database !== 'yishan') {
  throw new Error('Refusing --apply: only local database yishan is allowed');
}
if (summary.conflicts.length) {
  throw new Error(`Refusing --apply: ${summary.conflicts.join('; ')}`);
}
if (opportunities.length !== 2 || quotations.length !== 3) {
  throw new Error('Refusing --apply: explicit before-image rows changed');
}

const canonical = opportunities.find((row) => row.id === CANONICAL_OPPORTUNITY_ID);
const duplicate = opportunities.find((row) => row.id === DUPLICATE_OPPORTUNITY_ID);
const quote1 = quotations.find((row) => row.id === 1);
const quote3 = quotations.find((row) => row.id === 3);
const quote4 = quotations.find((row) => row.id === 4);
if (canonical.deleted_at || duplicate.deleted_at
  || canonical.stage !== 'negotiation' || duplicate.stage !== 'quotation'
  || canonical.amount_cents !== 6000000 || duplicate.amount_cents !== 6000000
  || canonical.owner_id !== 1 || duplicate.owner_id !== 1
  || quote1.opportunity_id !== 1 || quote3.opportunity_id !== 2 || quote4.opportunity_id !== 1
  || quote1.root_quote_id !== 1 || quote4.root_quote_id !== 1 || quote4.source_quote_id !== 1
  || quote1.status !== 'sent' || quote3.status !== 'sent' || quote4.status !== 'draft'
  || quote1.total_cents !== 6600000 || quote3.total_cents !== 6600000 || quote4.total_cents !== 6400000
  || new Date(canonical.expected_close_date).getTime() !== new Date(duplicate.expected_close_date).getTime()) {
  throw new Error('Refusing --apply: audited business facts changed');
}
if (summary.quotationIdsToReassociate.length !== 1 || summary.quotationIdsToReassociate[0] !== TEST_QUOTE_ID) {
  throw new Error('Refusing --apply: duplicate opportunity acquired another quote');
}

const connection = await pool.getConnection();
await connection.beginTransaction();
try {
  const [lockedOpportunities] = await connection.query(
    `SELECT id,stage,amount_cents,owner_id,deleted_at FROM crm_opportunity WHERE id IN (?,?) FOR UPDATE`,
    [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  if (lockedOpportunities.length !== 2 || lockedOpportunities.some((row) => row.deleted_at)) {
    throw new Error('Audited opportunities changed before transaction lock');
  }
  const [lockedQuotes] = await connection.query(
    `SELECT id,opportunity_id FROM crm_quotation WHERE opportunity_id IN (?,?) FOR UPDATE`,
    [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  if (lockedQuotes.length !== 3 || lockedQuotes.filter((row) => row.opportunity_id === DUPLICATE_OPPORTUNITY_ID).some((row) => row.id !== TEST_QUOTE_ID)) {
    throw new Error('Quote associations changed before transaction lock');
  }
  const [downstreamContracts] = await connection.query(
    `SELECT id FROM crm_contract WHERE customer_id=? FOR UPDATE`, [CUSTOMER_ID],
  );
  const [downstreamPayments] = await connection.query(
    `SELECT id FROM crm_payment WHERE customer_id=? FOR UPDATE`, [CUSTOMER_ID],
  );
  const [downstreamDirectCloses] = await connection.query(
    `SELECT id FROM crm_direct_close WHERE opportunity_id IN (?,?) FOR UPDATE`,
    [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  if (downstreamContracts.length || downstreamPayments.length || downstreamDirectCloses.length) {
    throw new Error('Downstream business objects appeared before transaction');
  }
  const [intentCollisions] = await connection.query(
    `SELECT d.product_id FROM crm_opportunity_product_intent d
       JOIN crm_opportunity_product_intent c
         ON c.opportunity_id=? AND c.product_id=d.product_id
      WHERE d.opportunity_id=?`,
    [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  if (intentCollisions.length) {
    throw new Error('Opportunity product intent collision; review before merging');
  }
  if (seriesTables.length) {
    await connection.query(
      `UPDATE crm_quotation_series SET opportunity_id=? WHERE customer_id=? AND opportunity_id=?`,
      [CANONICAL_OPPORTUNITY_ID, CUSTOMER_ID, DUPLICATE_OPPORTUNITY_ID],
    );
  }
  await connection.query(
    `UPDATE crm_quotation SET opportunity_id=? WHERE customer_id=? AND opportunity_id=?`,
    [CANONICAL_OPPORTUNITY_ID, CUSTOMER_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  await connection.query(
    `UPDATE crm_activity
        SET metadata = JSON_SET(metadata, '$.opportunityId', ?), updated_at = updated_at
      WHERE customer_id = ? AND JSON_EXTRACT(metadata,'$.opportunityId') = ?`,
    [CANONICAL_OPPORTUNITY_ID, CUSTOMER_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  await connection.query(
    `UPDATE crm_activity SET entity_id=? WHERE entity_type='opportunity' AND entity_id=?`,
    [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  await connection.query(
    `UPDATE crm_opportunity_stage_log SET opportunity_id=? WHERE opportunity_id=?`,
    [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  await connection.query(
    `UPDATE crm_opportunity_product_intent SET opportunity_id=? WHERE opportunity_id=?`,
    [CANONICAL_OPPORTUNITY_ID, DUPLICATE_OPPORTUNITY_ID],
  );
  await connection.query(
    `UPDATE crm_opportunity SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND customer_id = ? AND deleted_at IS NULL`,
    [DUPLICATE_OPPORTUNITY_ID, CUSTOMER_ID],
  );
  await connection.commit();
  console.error('repair applied: opportunity 2 archived, quote 3 and its series reassociated to opportunity 1; quote contents, items, shares and all activity rows preserved');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
