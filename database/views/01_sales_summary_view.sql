CREATE OR REPLACE VIEW vw_sales_summary AS
SELECT
    COUNT(DISTINCT o.order_id) AS total_orders,
    COALESCE(SUM(
        CASE
            WHEN p.payment_status = 'Success' THEN p.amount
            ELSE 0
        END
    ), 0) AS total_sales,
    COUNT(DISTINCT CASE WHEN o.status = 'Completed' THEN o.order_id END) AS completed_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'Pending' THEN o.order_id END) AS pending_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'Confirmed' THEN o.order_id END) AS confirmed_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'Preparing' THEN o.order_id END) AS preparing_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'Ready' THEN o.order_id END) AS ready_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'Cancelled' THEN o.order_id END) AS cancelled_orders
FROM orders o
LEFT JOIN payment p ON p.order_id = o.order_id;
