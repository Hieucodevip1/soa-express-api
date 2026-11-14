const { spawn } = require('child_process');

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('========================================================');
    console.log('--- BẮT ĐẦU KIỂM THỬ HỆ THỐNG SOA BÀI 2, BÀI 3, BÀI 4 ---');
    console.log('========================================================');

    // 1. Khởi chạy Auth Service (Bài 2 - Port 5000)
    const authProcess = spawn('node', ['server.js'], { stdio: 'pipe' });
    authProcess.stdout.on('data', data => console.log(`[Auth Service 5000]: ${data.toString().trim()}`));
    authProcess.stderr.on('data', data => console.error(`[Auth Service ERR]: ${data.toString().trim()}`));

    // 2. Khởi chạy Product Service (Bài 3 - Port 5001)
    const productProcess = spawn('node', ['product-service.js'], { stdio: 'pipe' });
    productProcess.stdout.on('data', data => console.log(`[Product Service 5001]: ${data.toString().trim()}`));
    productProcess.stderr.on('data', data => console.error(`[Product Service ERR]: ${data.toString().trim()}`));

    // 3. Khởi chạy Order Service (Bài 4 - Port 5002)
    const orderProcess = spawn('node', ['order-service.js'], { stdio: 'pipe' });
    orderProcess.stdout.on('data', data => console.log(`[Order Service 5002]: ${data.toString().trim()}`));
    orderProcess.stderr.on('data', data => console.error(`[Order Service ERR]: ${data.toString().trim()}`));

    // Đợi 2.5s để cả 3 service khởi động xong
    await wait(2500);

    let passedTests = 0;
    let totalTests = 0;

    function assertTest(condition, message) {
        totalTests++;
        if (condition) {
            console.log(`✅ [PASS] ${message}`);
            passedTests++;
        } else {
            console.error(`❌ [FAIL] ${message}`);
        }
    }

    try {
        // Test 1: Truy cập / trên Order Service
        console.log('\n--- TEST 1: Service Info Order Service (GET http://localhost:5002/) ---');
        const resRoot = await fetch('http://localhost:5002/');
        const dataRoot = await resRoot.json();
        assertTest(resRoot.status === 200 && dataRoot.success === true, 'Order Service phản hồi thông tin dịch vụ thành công');

        // Test 2: Gọi GET /orders KHÔNG có token (Kỳ vọng 401)
        console.log('\n--- TEST 2: Gọi GET /orders KHÔNG có token ---');
        const resNoAuth = await fetch('http://localhost:5002/orders');
        assertTest(resNoAuth.status === 401, `Từ chối truy cập khi không có token (Status: ${resNoAuth.status})`);

        // Test 3: Đăng nhập tại Auth Service (Port 5000) lấy JWT token
        console.log('\n--- TEST 3: Đăng nhập tại Auth Service (POST http://localhost:5000/login) ---');
        const resLogin = await fetch('http://localhost:5000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName: 'admin', password: '123' })
        });
        const loginData = await resLogin.json();
        const token = loginData.token;
        assertTest(resLogin.status === 200 && !!token, 'Lấy token JWT thành công từ Auth Service (Bài 2)');

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // Test 4: Gọi GET /orders CÓ token hợp lệ
        console.log('\n--- TEST 4: Lấy danh sách đơn hàng (GET http://localhost:5002/orders) ---');
        const resOrders = await fetch('http://localhost:5002/orders', { headers });
        const ordersData = await resOrders.json();
        assertTest(resOrders.status === 200 && Array.isArray(ordersData.data), 
            `Lấy danh sách đơn hàng thành công (Số lượng: ${ordersData.data ? ordersData.data.length : 0})`);

        // Test 5: Xem chi tiết đơn hàng ID 1 kèm danh sách items
        console.log('\n--- TEST 5: Xem chi tiết đơn hàng 1 (GET /orders/1) ---');
        const resOrder1 = await fetch('http://localhost:5002/orders/1', { headers });
        const order1Data = await resOrder1.json();
        assertTest(resOrder1.status === 200 && order1Data.data.id === 1 && Array.isArray(order1Data.data.items), 
            `Lấy chi tiết đơn hàng 1 thành công (Số mặt hàng: ${order1Data.data.items.length})`);

        // Test 6: Thử tạo đơn hàng vượt quá tồn kho (Kỳ vọng 400 Bad Request)
        console.log('\n--- TEST 6: Tạo đơn hàng vượt quá số lượng tồn kho trong Product Service ---');
        const resOverStock = await fetch('http://localhost:5002/orders', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                customer_name: 'Khách Hàng Test',
                customer_email: 'test@gmail.com',
                items: [{ product_id: 1, quantity: 99999 }]
            })
        });
        const overStockData = await resOverStock.json();
        assertTest(resOverStock.status === 400 && overStockData.message.includes('không đủ số lượng tồn kho'), 
            `Chặn đơn hàng vượt tồn kho thành công: "${overStockData.message}"`);

        // Test 7: Tạo đơn hàng hợp lệ (POST /orders) -> Kiểm tra trừ tồn kho trong Product Service
        console.log('\n--- TEST 7: Tạo đơn hàng mới hợp lệ và kiểm tra trừ tồn kho ---');
        // Lấy số lượng sản phẩm 1 hiện tại
        const resProd1Before = await fetch('http://localhost:5001/products/1', { headers });
        const prod1Before = (await resProd1Before.json()).data;
        const stockBefore = prod1Before.quantity;

        const resCreateOrder = await fetch('http://localhost:5002/orders', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                customer_name: 'Lê Thị Thu',
                customer_email: 'lethu@gmail.com',
                items: [{ product_id: 1, quantity: 2 }]
            })
        });
        const createdOrderData = await resCreateOrder.json();
        const createdOrderId = createdOrderData.data ? createdOrderData.data.id : null;

        // Lấy số lượng sản phẩm 1 sau khi tạo đơn
        const resProd1After = await fetch('http://localhost:5001/products/1', { headers });
        const prod1After = (await resProd1After.json()).data;
        const stockAfter = prod1After.quantity;

        assertTest(
            resCreateOrder.status === 201 && createdOrderId > 0 && stockAfter === (stockBefore - 2), 
            `Tạo đơn hàng ID: ${createdOrderId} thành công. Tồn kho sản phẩm 1 giảm từ ${stockBefore} -> ${stockAfter}`
        );

        // Test 8: Cập nhật trạng thái đơn hàng (PUT /orders/:id)
        console.log(`\n--- TEST 8: Cập nhật trạng thái đơn hàng ${createdOrderId} sang 'completed' ---`);
        const resUpdateOrder = await fetch(`http://localhost:5002/orders/${createdOrderId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'completed' })
        });
        const updateOrderData = await resUpdateOrder.json();
        assertTest(resUpdateOrder.status === 200 && updateOrderData.data.status === 'completed', 
            `Cập nhật trạng thái đơn hàng thành công: ${updateOrderData.data.status}`);

        // Test 9: Lấy danh sách chi tiết mặt hàng (GET /order_items)
        console.log('\n--- TEST 9: Lấy danh sách chi tiết mặt hàng (GET /order_items) ---');
        const resItems = await fetch('http://localhost:5002/order_items', { headers });
        const itemsData = await resItems.json();
        assertTest(resItems.status === 200 && Array.isArray(itemsData.data), 
            `Lấy danh sách mặt hàng thành công (Tổng số: ${itemsData.data.length})`);

        // Test 10: Thêm mặt hàng mới vào đơn hàng (POST /order_items)
        console.log(`\n--- TEST 10: Thêm mặt hàng mới vào đơn hàng ${createdOrderId} (POST /order_items) ---`);
        const resAddOrderItem = await fetch('http://localhost:5002/order_items', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                order_id: createdOrderId,
                product_id: 2,
                quantity: 1
            })
        });
        const addOrderItemData = await resAddOrderItem.json();
        const createdItemId = addOrderItemData.data ? addOrderItemData.data.id : null;
        assertTest(resAddOrderItem.status === 201 && createdItemId > 0, 
            `Thêm mặt hàng mới thành công với Item ID: ${createdItemId}`);

        // Test 11: Cập nhật số lượng mặt hàng (PUT /order_items/:id)
        console.log(`\n--- TEST 11: Cập nhật số lượng mặt hàng ${createdItemId} (PUT /order_items/:id) ---`);
        const resUpdateItem = await fetch(`http://localhost:5002/order_items/${createdItemId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ quantity: 2 })
        });
        const updateItemData = await resUpdateItem.json();
        assertTest(resUpdateItem.status === 200 && updateItemData.data.quantity === 2, 
            `Cập nhật số lượng mặt hàng thành công (Quantity: ${updateItemData.data.quantity})`);

        // Test 12: Xóa mặt hàng trong đơn hàng (DELETE /order_items/:id)
        console.log(`\n--- TEST 12: Xóa mặt hàng ${createdItemId} (DELETE /order_items/:id) ---`);
        const resDeleteItem = await fetch(`http://localhost:5002/order_items/${createdItemId}`, {
            method: 'DELETE',
            headers
        });
        const deleteItemData = await resDeleteItem.json();
        assertTest(resDeleteItem.status === 200 && deleteItemData.success === true, 
            `Xóa mặt hàng ${createdItemId} thành công`);

        // Test 13: Xóa đơn hàng vừa tạo (DELETE /orders/:id)
        console.log(`\n--- TEST 13: Xóa đơn hàng ${createdOrderId} (DELETE /orders/:id) ---`);
        const resDeleteOrder = await fetch(`http://localhost:5002/orders/${createdOrderId}`, {
            method: 'DELETE',
            headers
        });
        const deleteOrderData = await resDeleteOrder.json();
        assertTest(resDeleteOrder.status === 200 && deleteOrderData.success === true, 
            `Xóa đơn hàng ID: ${createdOrderId} thành công`);

        // Test 14: Kiểm tra đơn hàng đã xóa không còn tồn tại (GET /orders/:id kỳ vọng 404)
        console.log(`\n--- TEST 14: Xác nhận đơn hàng đã xóa (GET /orders/${createdOrderId}) ---`);
        const resCheckDeletedOrder = await fetch(`http://localhost:5002/orders/${createdOrderId}`, { headers });
        assertTest(resCheckDeletedOrder.status === 404, `Xác nhận đơn hàng không còn tồn tại (Status: 404)`);

    } catch (err) {
        console.error('Lỗi khi thực hiện kiểm thử:', err);
    } finally {
        console.log(`\n========================================================`);
        console.log(`KẾT QUẢ KIỂM THỬ TỔNG HỢP: ${passedTests}/${totalTests} TESTS ĐẠT YÊU CẦU`);
        console.log(`========================================================`);

        // Dọn dẹp process
        authProcess.kill();
        productProcess.kill();
        orderProcess.kill();
        process.exit(passedTests === totalTests ? 0 : 1);
    }
}

runTests();
