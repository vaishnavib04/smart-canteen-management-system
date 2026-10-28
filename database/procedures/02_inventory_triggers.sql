USE smart_canteen_db;

DROP TRIGGER IF EXISTS before_inventory_update;

DELIMITER //

CREATE TRIGGER before_inventory_update
BEFORE UPDATE ON inventory
FOR EACH ROW
BEGIN
    IF NEW.quantity_available < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Inventory quantity cannot be negative';
    END IF;

    IF NEW.reorder_level < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Reorder level cannot be negative';
    END IF;
END //

DELIMITER ;