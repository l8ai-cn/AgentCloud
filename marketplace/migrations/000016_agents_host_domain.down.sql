DELETE FROM marketplace.marketplace_domains
WHERE host = 'agents.l8ai.cn'
  AND verification_token = 'platform-market-agents';
