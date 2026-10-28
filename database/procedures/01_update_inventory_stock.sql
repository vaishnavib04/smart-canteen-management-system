USE smart_canteen_db;

DROP PROCEDURE IF EXISTS UpdateInventoryStock;

DELIMITER //

CREATE PROCEDURE UpdateInventoryStock(
    IN p_inventory_id BIGINT UNSIGNED,
    IN p_new_quantity INT
)
BEGIN
    IF p_new_quantity < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Inventory quantity cannot be negative';
    END IF;

    UPDATE inventory
    SET quantity_available = p_new_quantity
    WHERE inventory_id = p_inventory_id;

    IF ROW_COUNT() = 0 THEN
        IF NOT EXISTS (
            SELECT 1
            FROM inventory
            WHERE inventory_id = p_inventory_id
        ) THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Inventory record not found';
        END IF;
    END IF;
END //

DELIMITER ;