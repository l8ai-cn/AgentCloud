INSERT INTO marketplace.marketplace_domains
    (marketplace_id, host, kind, status, verification_token, is_primary, verified_at)
SELECT m.id, 'agents.l8ai.cn', 'platform', 'active',
       'platform-market-agents', FALSE, NOW()
FROM marketplace.marketplaces m
WHERE m.slug = 'agent-cloud-market'
  AND NOT EXISTS (
      SELECT 1 FROM marketplace.marketplace_domains d
      WHERE d.host = 'agents.l8ai.cn'
  );
