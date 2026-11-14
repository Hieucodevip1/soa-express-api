const {
    readOrders,
    readOrderItems,
    saveOrderItems,
    recalculateOrderTotal,
    getProductFromProductService,
    updateProductStock
} = require('../utils/orderDb');

const orderItemController = {
    // 1. GET /order_items: Lấy danh sách tất cả mặt hàng trong đơn hàng
    getAllOrderItems: (req, res) => {
        try {
            let items = readOrderItems();
            const orderIdQuery = req.query.order_id;

            // Hỗ trợ lọc theo đơn hàng cụ thể nếu truyền query ?order_id=...
            if (orderIdQuery) {
                const orderId = parseInt(orderIdQuery, 10);
                if (!isNaN(orderId)) {
                    items = items.filter(item => item.order_id === orderId);
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Lấy danh sách mặt hàng thành công',
                total: items.length,
                data: items
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách mặt hàng: ' + error.message
            });
        }
    },

    // 2. GET /order_items/:id: Lấy thông tin chi tiết một mặt hàng
    getOrderItemById: (req, res) => {
        try {
            const itemId = parseInt(req.params.id, 10);
            if (isNaN(itemId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID mặt hàng không hợp lệ (phải là số nguyên)'
                });
            }

            const items = readOrderItems();
            const item = items.find(i => i.id === itemId);

            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy chi tiết mặt hàng có ID = ${itemId}`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Lấy thông tin chi tiết mặt hàng thành công',
                data: item
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy chi tiết mặt hàng: ' + error.message
            });
        }
    },

    // 3. POST /order_items: Tạo mặt hàng mới cho đơn hàng (kiểm tra tồn kho qua Product Service)
    createOrderItem: async (req, res) => {
        try {
            const { order_id, product_id, quantity } = req.body;

            const parsedOrderId = parseInt(order_id, 10);
            const parsedProductId = parseInt(product_id, 10);
            const parsedQuantity = parseInt(quantity, 10);

            if (isNaN(parsedOrderId) || isNaN(parsedProductId) || isNaN(parsedQuantity) || parsedQuantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Thông tin không hợp lệ: order_id, product_id và quantity (phải > 0) là bắt buộc'
                });
            }

            // Kiểm tra xem đơn hàng có tồn tại không
            const orders = readOrders();
            const order = orders.find(o => o.id === parsedOrderId);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy đơn hàng có ID = ${parsedOrderId} để thêm mặt hàng`
                });
            }

            // Kiểm tra thông tin và tồn kho sản phẩm từ Product Service (SOA)
            const authHeader = req.headers['authorization'];
            let product;
            try {
                product = await getProductFromProductService(parsedProductId, authHeader);
            } catch (svcErr) {
                return res.status(503).json({
                    success: false,
                    message: `Không thể kết nối Product Service để kiểm tra sản phẩm: ${svcErr.message}`
                });
            }

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Sản phẩm có ID = ${parsedProductId} không tồn tại trong hệ thống`
                });
            }

            if (product.quantity < parsedQuantity) {
                return res.status(400).json({
                    success: false,
                    message: `Sản phẩm "${product.name}" không đủ tồn kho. Hiện có: ${product.quantity}, yêu cầu: ${parsedQuantity}`
                });
            }

            // Tạo item mới
            const items = readOrderItems();
            const nextId = items.length > 0 ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;
            const unitPrice = parseFloat(Number(product.price).toFixed(2));
            const totalPrice = parseFloat((unitPrice * parsedQuantity).toFixed(2));

            const newItem = {
                id: nextId,
                order_id: parsedOrderId,
                product_id: product.id,
                product_name: product.name,
                quantity: parsedQuantity,
                unit_price: unitPrice,
                total_price: totalPrice
            };

            items.push(newItem);
            saveOrderItems(items);

            // Cập nhật trừ tồn kho trong Product Service
            await updateProductStock(product.id, product.quantity - parsedQuantity, authHeader);

            // Tự động tính toán lại tổng tiền của đơn hàng
            recalculateOrderTotal(parsedOrderId);

            return res.status(201).json({
                success: true,
                message: 'Tạo mặt hàng mới thành công',
                data: newItem
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo mặt hàng mới: ' + error.message
            });
        }
    },

    // 4. PUT /order_items/:id: Cập nhật mặt hàng (số lượng)
    updateOrderItem: async (req, res) => {
        try {
            const itemId = parseInt(req.params.id, 10);
            if (isNaN(itemId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID mặt hàng không hợp lệ'
                });
            }

            const items = readOrderItems();
            const itemIndex = items.findIndex(i => i.id === itemId);

            if (itemIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy chi tiết mặt hàng có ID = ${itemId} để cập nhật`
                });
            }

            const existingItem = items[itemIndex];
            const { quantity } = req.body;

            if (quantity !== undefined) {
                const newQuantity = parseInt(quantity, 10);
                if (isNaN(newQuantity) || newQuantity <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Số lượng sản phẩm (quantity) phải là số nguyên > 0'
                    });
                }

                const diff = newQuantity - existingItem.quantity;
                const authHeader = req.headers['authorization'];

                if (diff !== 0) {
                    // Kiểm tra tồn kho nếu số lượng tăng lên
                    const product = await getProductFromProductService(existingItem.product_id, authHeader);
                    if (product) {
                        if (diff > 0 && product.quantity < diff) {
                            return res.status(400).json({
                                success: false,
                                message: `Không đủ tồn kho bổ sung. Tồn kho hiện có: ${product.quantity}, cần thêm: ${diff}`
                            });
                        }
                        // Cập nhật lại tồn kho trong Product Service
                        await updateProductStock(product.id, product.quantity - diff, authHeader);
                    }
                }

                existingItem.quantity = newQuantity;
                existingItem.total_price = parseFloat((existingItem.unit_price * newQuantity).toFixed(2));
            }

            items[itemIndex] = existingItem;
            saveOrderItems(items);

            // Tính toán lại tổng tiền của đơn hàng
            recalculateOrderTotal(existingItem.order_id);

            return res.status(200).json({
                success: true,
                message: 'Cập nhật mặt hàng thành công',
                data: existingItem
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật mặt hàng: ' + error.message
            });
        }
    },

    // 5. DELETE /order_items/:id: Xóa một mặt hàng trong đơn hàng
    deleteOrderItem: async (req, res) => {
        try {
            const itemId = parseInt(req.params.id, 10);
            if (isNaN(itemId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID mặt hàng không hợp lệ'
                });
            }

            const items = readOrderItems();
            const itemIndex = items.findIndex(i => i.id === itemId);

            if (itemIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy chi tiết mặt hàng có ID = ${itemId} để xóa`
                });
            }

            const deletedItem = items.splice(itemIndex, 1)[0];
            saveOrderItems(items);

            // Hoàn lại số lượng tồn kho vào Product Service
            const authHeader = req.headers['authorization'];
            try {
                const product = await getProductFromProductService(deletedItem.product_id, authHeader);
                if (product) {
                    await updateProductStock(product.id, product.quantity + deletedItem.quantity, authHeader);
                }
            } catch (stockErr) {
                console.warn(`[SOA Warning] Không thể hoàn kho khi xóa mặt hàng ID ${itemId}:`, stockErr.message);
            }

            // Tự động tính lại tổng tiền của đơn hàng
            recalculateOrderTotal(deletedItem.order_id);

            return res.status(200).json({
                success: true,
                message: `Xóa mặt hàng có ID = ${itemId} thành công`,
                data: deletedItem
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa mặt hàng: ' + error.message
            });
        }
    }
};

module.exports = orderItemController;
