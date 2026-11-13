-- Read-only preflight before migration 20261210000012. Run on the target DB.
SELECT 'missing_branch' AS issue, count(*) AS rows FROM product_stops WHERE branch_id IS NULL
UNION ALL
SELECT 'missing_branch_product_relation', count(*)
FROM product_stops s
WHERE NOT EXISTS (
  SELECT 1 FROM entity_relations r
  WHERE r.from_entity_type = 'Branch' AND r.from_id = s.branch_id
    AND r.to_entity_type = 'Product' AND r.to_id = s.product_id
)
UNION ALL
SELECT 'duplicate_branch_product_source', count(*)
FROM (
  SELECT 1 FROM product_stops
  GROUP BY branch_id, product_id, source HAVING count(*) > 1
) conflicts;

-- A nonzero result blocks rollback to the old unique key.
SELECT product_id, source, count(*) AS branch_rows
FROM product_stops
GROUP BY product_id, source HAVING count(*) > 1;

SELECT 'external_id_missing_branch' AS issue, count(*) AS rows
FROM external_ids WHERE branch_id IS NULL
UNION ALL
SELECT 'external_id_duplicate_branch_key', count(*)
FROM (
  SELECT 1 FROM external_ids
  GROUP BY entity_type, entity_id, branch_id, provider HAVING count(*) > 1
) conflicts;

-- A nonzero result blocks rollback to the old external ID key.
SELECT entity_type, entity_id, provider, count(*) AS branch_rows
FROM external_ids
GROUP BY entity_type, entity_id, provider HAVING count(*) > 1;
