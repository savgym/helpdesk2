CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_total      int;
  v_open       int;
  v_ai         int;
  v_avg        numeric;
  v_pct        numeric;
  v_daily      json;
BEGIN
  SELECT COUNT(*) INTO v_total FROM "Ticket";

  SELECT COUNT(*) INTO v_open
  FROM "Ticket" WHERE status = 'OPEN';

  SELECT COUNT(*) INTO v_ai
  FROM "Ticket" WHERE "resolvedByAI" = true;

  SELECT EXTRACT(EPOCH FROM AVG("resolvedAt" - "createdAt")) / 60
  INTO v_avg
  FROM "Ticket"
  WHERE "resolvedByAI" = true AND "resolvedAt" IS NOT NULL;

  v_pct := CASE WHEN v_total > 0
    THEN ROUND((v_ai::numeric / v_total) * 1000) / 10
    ELSE 0
  END;

  SELECT json_agg(t)
  INTO v_daily
  FROM (
    SELECT
      to_char(day, 'YYYY-MM-DD') AS date,
      COALESCE(counts.ticket_count, 0) AS count
    FROM generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    ) AS day
    LEFT JOIN (
      SELECT DATE("createdAt") AS d, COUNT(*)::int AS ticket_count
      FROM "Ticket"
      WHERE "createdAt" >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY DATE("createdAt")
    ) counts ON counts.d = day
    ORDER BY day
  ) t;

  RETURN json_build_object(
    'totalTickets',         v_total,
    'openTickets',          v_open,
    'resolvedByAI',         v_ai,
    'resolvedByAIPercent',  v_pct,
    'avgResolutionMinutes', CASE WHEN v_avg IS NOT NULL THEN ROUND(v_avg) ELSE NULL END,
    'ticketsPerDay',        v_daily
  );
END;
$$;
