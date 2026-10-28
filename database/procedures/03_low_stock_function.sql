USE smart_canteen_db;

DELIMITER //

CREATE FUNCTION IsLowStock(
    p_inventory_id BIGINT UNSIGNED
)
RETURNS TINYINT
READS SQL DATA
BEGIN
    DECLARE current_quantity INT;
    DECLARE current_reorder_level INT;

    SELECT quantity_available, reorder_level
    INTO current_quantity, current_reorder_level
    FROM inventory
    WHERE inventory_id = p_inventory_id;

    RETURN IF(
        current_quantity <= current_reorder_level,
        1,
        0
    );
END //

DELIMITER ;