-- ============================================================
-- M1 - Part H: Student order views and indexes
-- Database: smart_canteen_db   |   MySQL 8.0
-- Run after Part A, Part B and the repo's database/ scripts.
-- Existing objects (do not duplicate): vw_sales_summary (M2)
-- ============================================================

USE smart_canteen_db;

-- ------------------------------------------------------------
-- 1. INDEXES ALREADY PRESENT (created automatically by keys)
-- ------------------------------------------------------------
SHOW INDEX FROM orders;
SHOW INDEX FROM order_item;
SHOW INDEX FROM pickup_slot;

-- ------------------------------------------------------------
-- 2. VIEWS
-- ------------------------------------------------------------

-- 2a. One row per order line: used for a student's order history page.
CREATE OR REPLACE VIEW v_student_order_history AS
SELECT
    o.order_id,
    o.user_id,
    o.order_date,
    o.status,
    o.total_amount,
    TIME_FORMAT(ps.slot_time, '%H:%i') AS pickup_time,
    f.item_id,
    f.name                              AS item_name,
    oi.quantity,
    oi.price_at_order,
    oi.quantity * oi.price_at_order     AS line_total,
    p.payment_mode,
    p.payment_status
FROM orders o
JOIN order_item oi        ON oi.order_id = o.order_id
JOIN food_item  f         ON f.item_id   = oi.item_id
LEFT JOIN pickup_slot ps  ON ps.slot_id  = o.slot_id
LEFT JOIN payment     p   ON p.order_id  = o.order_id;

-- 2b. One row per order: used for order summaries.
CREATE OR REPLACE VIEW v_order_summary AS
SELECT
    o.order_id,
    o.user_id,
    u.name                              AS customer_name,
    o.order_date,
    o.status,
    o.total_amount,
    COUNT(oi.item_id)                   AS distinct_items,
    COALESCE(SUM(oi.quantity), 0)       AS total_units,
    TIME_FORMAT(ps.slot_time, '%H:%i')  AS pickup_time,
    p.payment_mode,
    p.payment_status
FROM orders o
JOIN users u              ON u.user_id   = o.user_id
LEFT JOIN order_item oi   ON oi.order_id = o.order_id
LEFT JOIN pickup_slot ps  ON ps.slot_id  = o.slot_id
LEFT JOIN payment     p   ON p.order_id  = o.order_id
GROUP BY
    o.order_id, o.user_id, u.name, o.order_date, o.status,
    o.total_amount, ps.slot_time, p.payment_mode, p.payment_status;

-- ------------------------------------------------------------
-- 3. INDEXES
-- ------------------------------------------------------------
-- Before: how the order-history and slot-capacity queries run.
EXPLAIN SELECT order_id, status, total_amount
        FROM orders WHERE user_id = 1 ORDER BY order_date DESC;
EXPLAIN SELECT COUNT(*) FROM orders
        WHERE slot_id = 2 AND status <> 'Cancelled';
EXPLAIN SELECT order_id FROM orders WHERE status = 'Pending';

-- Student order history: WHERE user_id = ? ORDER BY order_date DESC
CREATE INDEX idx_orders_user_date ON orders (user_id, order_date);

-- Pickup-slot capacity check used by POST /api/orders
CREATE INDEX idx_orders_slot_status ON orders (slot_id, status);

-- Staff filtering by order status
CREATE INDEX idx_orders_status ON orders (status);

-- After:
EXPLAIN SELECT order_id, status, total_amount
        FROM orders WHERE user_id = 1 ORDER BY order_date DESC;
EXPLAIN SELECT COUNT(*) FROM orders
        WHERE slot_id = 2 AND status <> 'Cancelled';
EXPLAIN SELECT order_id FROM orders WHERE status = 'Pending';

SHOW INDEX FROM orders;

-- ------------------------------------------------------------
-- 4. VIEW DEMONSTRATIONS
-- ------------------------------------------------------------
-- A student's history (Aarav, user_id = 1)
SELECT * FROM v_student_order_history
WHERE user_id = 1
ORDER BY order_date DESC, order_id, item_name;

-- Order summaries
SELECT * FROM v_order_summary ORDER BY order_id;

-- Orders awaiting payment
SELECT order_id, customer_name, total_amount, status
FROM v_order_summary
WHERE payment_status IS NULL;
