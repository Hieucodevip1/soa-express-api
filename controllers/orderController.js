const {
    readOrders,
    saveOrders,
    readOrderItems,
    saveOrderItems,
    getProductFromProductService,
    updateProductStock
} = require('../utils/orderDb');

const ALLOWED_STATUSES = ['pending', 'completed', 'cancelled'];

const orderController = {
    // 1. GET /orders: Lấy danh sách tất cả các đơn hàng
    getAllOrders: (req, res) => {
        try {
            const orders = readOrders();
            const orderItems = readOrderItems();

            // Gắn danh sách mặt hàng kèm theo mỗi đơn hàng
            const ordersWithItems = orders.map(order => ({
                ...order,
                items: orderItems.filter(item => item.order_id === order.id)
            }));

            return res.status(200).json({
                success: true,
                message: 'Lấy danh sách đơn hàng thành công',
                total: ordersWithItems.length,
                data: ordersWithItems
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách đơn hàng: ' + error.message
            });
        }
    },

    // 2. GET /orders/:id: Lấy thông tin chi tiết một đơn hàng
    getOrderById: (req, res) => {
        try {
            const orderId = parseInt(req.params.id, 10);
            if (isNaN(orderId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID đơn hàng không hợp lệ (phải là số nguyên)'
                });
            }

            const orders = readOrders();
            const order = orders.find(o => o.id === orderId);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy đơn hàng có ID = ${orderId}`
                });
            }

            const orderItems = readOrderItems();
            const items = orderItems.filter(item => item.order_id === orderId);

            return res.status(200).json({
                success: true,
                message: 'Lấy chi tiết đơn hàng thành công',
                data: {
                    ...order,
                    items: items
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy chi tiết đơn hàng: ' + error.message
            });
        }
    },

    // 3. POST /orders: Tạo đơn hàng mới (kiểm tra tồn kho qua Product Service)
    createOrder: async (req, res) => {
        try {
            const { customer_name, customer_email, items } = req.body;

            // Validate thông tin khách hàng
            if (!customer_name || typeof customer_name !== 'string' || customer_name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Tên khách hàng (customer_name) là bắt buộc'
                });
            }

            if (!customer_email || typeof customer_email !== 'string' || !customer_email.includes('@')) {
                return res.status(400).json({
                    success: false,
                    message: 'Email khách hàng (customer_email) không hợp lệ'
                });
            }

            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Danh sách mặt hàng (items) là bắt buộc và phải có ít nhất 1 sản phẩm'
                });
            }

            const authHeader = req.headers['authorization'];
            const checkedProducts = [];

            // Kiểm tra tồn kho cho từng sản phẩm từ Product Service (SOA)
            for (const item of items) {
                const productId = parseInt(item.product_id, 10);
                const quantity = parseInt(item.quantity, 10);

                if (isNaN(productId) || isNaN(quantity) || quantity <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Thông tin sản phẩm trong đơn hàng không hợp lệ (product_id và quantity > 0)'
                    });
                }

                let product;
                try {
                    product = await getProductFromProductService(productId, authHeader);
                } catch (svcErr) {
                    return res.status(503).json({
                        success: false,
                        message: `Không thể kết nối đến Product Service để kiểm tra sản phẩm ID ${productId}. Vui lòng đảm bảo Product Service đang hoạt động.`
                    });
                }

                if (!product) {
                    return res.status(404).json({
                        success: false,
                        message: `Sản phẩm có ID = ${productId} không tồn tại trong hệ thống`
                    });
                }

                if (product.quantity < quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Sản phẩm "${product.name}" (ID: ${product.id}) không đủ số lượng tồn kho. Hiện còn: ${product.quantity}, yêu cầu: ${quantity}`
                    });
                }

                checkedProducts.push({
                    product,
                    quantity
                });
            }

            // Dữ liệu hợp lệ -> Bắt đầu tạo đơn hàng và các mặt hàng chi tiết
            const orders = readOrders();
            const orderItems = readOrderItems();

            const nextOrderId = orders.length > 0 ? Math.max(...orders.map(o => o.id || 0)) + 1 : 1;
            let nextItemId = orderItems.length > 0 ? Math.max(...orderItems.map(i => i.id || 0)) + 1 : 1;

            let totalAmount = 0;
            const newOrderItems = [];

            for (const checked of checkedProducts) {
                const { product, quantity } = checked;
                const unitPrice = parseFloat(Number(product.price).toFixed(2));
                const totalPrice = parseFloat((unitPrice * quantity).toFixed(2));
                totalAmount += totalPrice;

                const orderItem = {
                    id: nextItemId++,
                    order_id: nextOrderId,
                    product_id: product.id,
                    product_name: product.name,
                    quantity: quantity,
                    unit_price: unitPrice,
                    total_price: totalPrice
                };

                newOrderItems.push(orderItem);

                // Giảm số lượng tồn kho trong Product Service theo chuẩn kiến trúc SOA
                const remainingStock = product.quantity - quantity;
                await updateProductStock(product.id, remainingStock, authHeader);
            }

            const now = new Date().toISOString();
            const newOrder = {
                id: nextOrderId,
                customer_name: customer_name.trim(),
                customer_email: customer_email.trim(),
                total_amount: parseFloat(totalAmount.toFixed(2)),
                status: 'pending',
                created_at: now,
                updated_at: now
            };

            orders.push(newOrder);
            orderItems.push(...newOrderItems);

            saveOrders(orders);
            saveOrderItems(orderItems);

            return res.status(201).json({
                success: true,
                message: 'Tạo đơn hàng mới thành công (Đã kiểm tra và cập nhật tồn kho)',
                data: {
                    ...newOrder,
                    items: newOrderItems
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo đơn hàng: ' + error.message
            });
        }
    },

    // 4. PUT /orders/:id: Cập nhật trạng thái đơn hàng (pending, completed, cancelled)
    updateOrderStatus: async (req, res) => {
        try {
            const orderId = parseInt(req.params.id, 10);
            if (isNaN(orderId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID đơn hàng không hợp lệ'
                });
            }

            const orders = readOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);

            if (orderIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy đơn hàng có ID = ${orderId} để cập nhật`
                });
            }

            const existingOrder = orders[orderIndex];
            const { status, customer_name, customer_email } = req.body;

            if (status !== undefined) {
                if (!ALLOWED_STATUSES.includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: `Trạng thái không hợp lệ. Chỉ chấp nhận một trong các giá trị: ${ALLOWED_STATUSES.join(', ')}`
                    });
                }

                // Nếu đơn hàng bị hủy (cancelled) từ trạng thái khác: hoàn trả lại tồn kho vào Product Service
                if (status === 'cancelled' && existingOrder.status !== 'cancelled') {
                    const orderItems = readOrderItems().filter(i => i.order_id === orderId);
                    const authHeader = req.headers['authorization'];

                    for (const item of orderItems) {
                        try {
                            const product = await getProductFromProductService(item.product_id, authHeader);
                            if (product) {
                                await updateProductStock(product.id, product.quantity + item.quantity, authHeader);
                            }
                        } catch (err) {
                            console.warn(`[SOA Warning] Không thể hoàn kho cho Product ID ${item.product_id}:`, err.message);
                        }
                    }
                }

                existingOrder.status = status;
            }

            if (customer_name !== undefined && customer_name.trim() !== '') {
                existingOrder.customer_name = customer_name.trim();
            }

            if (customer_email !== undefined && customer_email.includes('@')) {
                existingOrder.customer_email = customer_email.trim();
            }

            existingOrder.updated_at = new Date().toISOString();
            orders[orderIndex] = existingOrder;
            saveOrders(orders);

            return res.status(200).json({
                success: true,
                message: 'Cập nhật trạng thái đơn hàng thành công',
                data: existingOrder
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật trạng thái đơn hàng: ' + error.message
            });
        }
    },

    // 5. DELETE /orders/:id: Xóa một đơn hàng (và các mặt hàng liên quan)
    deleteOrder: (req, res) => {
        try {
            const orderId = parseInt(req.params.id, 10);
            if (isNaN(orderId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID đơn hàng không hợp lệ'
                });
            }

            const orders = readOrders();
            const orderIndex = orders.findIndex(o => o.id === orderId);

            if (orderIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy đơn hàng có ID = ${orderId} để xóa`
                });
            }

            const deletedOrder = orders.splice(orderIndex, 1)[0];
            saveOrders(orders);

            // Xóa toàn bộ chi tiết đơn hàng (order_items) liên quan
            const orderItems = readOrderItems();
            const remainingItems = orderItems.filter(item => item.order_id !== orderId);
            saveOrderItems(remainingItems);

            return res.status(200).json({
                success: true,
                message: `Xóa đơn hàng ID = ${orderId} và các chi tiết đơn hàng liên quan thành công`,
                data: deletedOrder
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa đơn hàng: ' + error.message
            });
        }
    }
};

module.exports = orderController;
