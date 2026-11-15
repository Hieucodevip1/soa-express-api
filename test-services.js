const { spawn } = require('child_process');

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('================================================================');
    console.log('--- BẮT ĐẦU KIỂM THỬ HỆ THỐNG SOA BÀI 2, BÀI 3, BÀI 4, BÀI 5 ---');
    console.log('================================================================');

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

    // 4. Khởi chạy Reporting Service (Bài 5 - Port 5003)
    const reportProcess = spawn('node', ['report-service.js'], { stdio: 'pipe' });
    reportProcess.stdout.on('data', data => console.log(`[Report Service 5003]: ${data.toString().trim()}`));
    reportProcess.stderr.on('data', data => console.error(`[Report Service ERR]: ${data.toString().trim()}`));

    // Đợi 3s để cả 4 service khởi động xong
    await wait(3000);

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
        // --- 1. XÁC THỰC VÀ INFO DỊCH VỤ ---
        console.log('\n--- TEST 1: Service Info Reporting Service (GET http://localhost:5003/) ---');
        const resRoot = await fetch('http://localhost:5003/');
        const dataRoot = await resRoot.json();
        assertTest(resRoot.status === 200 && dataRoot.success === true, 'Reporting Service phản hồi thông tin dịch vụ thành công');

        console.log('\n--- TEST 2: Gọi GET /reports/orders KHÔNG có token ---');
        const resNoAuth = await fetch('http://localhost:5003/reports/orders');
        assertTest(resNoAuth.status === 401, `Từ chối truy cập khi không có token (Status: ${resNoAuth.status})`);

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

        // --- 2. BÁO CÁO ĐƠN HÀNG (ORDERS REPORTS) ---
        console.log('\n--- TEST 4: Lấy danh sách báo cáo đơn hàng (GET http://localhost:5003/reports/orders) ---');
        const resOrdersReports = await fetch('http://localhost:5003/reports/orders', { headers });
        const ordersReportsData = await resOrdersReports.json();
        assertTest(resOrdersReports.status === 200 && Array.isArray(ordersReportsData.data), 
            `Lấy danh sách báo cáo đơn hàng thành công (Tổng số: ${ordersReportsData.data.length})`);

        console.log('\n--- TEST 5: Xem chi tiết báo cáo đơn hàng 1 (GET /reports/orders/1) ---');
        const resOrderReport1 = await fetch('http://localhost:5003/reports/orders/1', { headers });
        const report1Data = await resOrderReport1.json();
        assertTest(resOrderReport1.status === 200 && report1Data.data.id === 1 && report1Data.data.total_profit > 0, 
            `Lấy chi tiết báo cáo đơn hàng 1 thành công (Doanh thu: ${report1Data.data.total_revenue}, Lợi nhuận: ${report1Data.data.total_profit})`);

        console.log('\n--- TEST 6: Tạo báo cáo đơn hàng mới (POST /reports/orders cho đơn hàng 2) ---');
        const resCreateOrderReport = await fetch('http://localhost:5003/reports/orders', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                order_id: 2,
                total_cost: 250000
            })
        });
        const createOrderReportData = await resCreateOrderReport.json();
        const createdOrderReportId = createOrderReportData.data ? createOrderReportData.data.id : null;
        assertTest(
            resCreateOrderReport.status === 201 && createdOrderReportId > 0 && createOrderReportData.data.total_profit === (createOrderReportData.data.total_revenue - 250000), 
            `Tạo báo cáo đơn hàng thành công với ID: ${createdOrderReportId} (Doanh thu: ${createOrderReportData.data.total_revenue}, Chi phí: 250000, Lợi nhuận: ${createOrderReportData.data.total_profit})`
        );

        // --- 3. BÁO CÁO SẢN PHẨM (PRODUCT REPORTS) ---
        console.log('\n--- TEST 7: Lấy danh sách báo cáo sản phẩm (GET http://localhost:5003/reports/products) ---');
        const resProductReports = await fetch('http://localhost:5003/reports/products', { headers });
        const productReportsData = await resProductReports.json();
        assertTest(resProductReports.status === 200 && Array.isArray(productReportsData.data), 
            `Lấy danh sách báo cáo sản phẩm thành công (Tổng số: ${productReportsData.data.length})`);

        console.log('\n--- TEST 8: Xem chi tiết báo cáo sản phẩm 1 (GET /reports/products/1) ---');
        const resProductReport1 = await fetch('http://localhost:5003/reports/products/1', { headers });
        const prodReport1Data = await resProductReport1.json();
        assertTest(resProductReport1.status === 200 && prodReport1Data.data.id === 1, 
            `Lấy chi tiết báo cáo sản phẩm 1 thành công (Đã bán: ${prodReport1Data.data.total_sold}, Lợi nhuận: ${prodReport1Data.data.profit})`);

        console.log('\n--- TEST 9: Tạo báo cáo sản phẩm mới (POST /reports/products liên kết Product Service & Order Service) ---');
        const resCreateProdReport = await fetch('http://localhost:5003/reports/products', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                product_id: 1,
                cost_rate: 0.65
            })
        });
        const createProdReportData = await resCreateProdReport.json();
        const createdProdReportId = createProdReportData.data ? createProdReportData.data.id : null;
        assertTest(
            resCreateProdReport.status === 201 && createdProdReportId > 0 && createProdReportData.data.product_id === 1, 
            `Tạo báo cáo sản phẩm 1 thành công (Tên: ${createProdReportData.data.product_name}, Tồn kho: ${createProdReportData.data.stock_quantity}, Đã bán: ${createProdReportData.data.total_sold}, Doanh thu: ${createProdReportData.data.revenue})`
        );

        // --- 4. THỐNG KÊ TỔNG QUAN (SUMMARY) ---
        console.log('\n--- TEST 10: Thống kê tổng quan (GET http://localhost:5003/reports/summary) ---');
        const resSummary = await fetch('http://localhost:5003/reports/summary', { headers });
        const summaryData = await resSummary.json();
        assertTest(
            resSummary.status === 200 && summaryData.data.total_revenue > 0 && summaryData.data.total_stock > 0, 
            `Báo cáo tổng quan thành công (Hàng tồn: ${summaryData.data.total_stock}, Hàng bán: ${summaryData.data.total_sold}, Doanh thu: ${summaryData.data.total_revenue}, Lợi nhuận: ${summaryData.data.total_profit})`
        );

        // --- 5. XÓA BÁO CÁO (DELETE) ---
        console.log(`\n--- TEST 11: Xóa báo cáo sản phẩm vừa tạo (DELETE /reports/products/${createdProdReportId}) ---`);
        const resDeleteProdReport = await fetch(`http://localhost:5003/reports/products/${createdProdReportId}`, {
            method: 'DELETE',
            headers
        });
        const deleteProdData = await resDeleteProdReport.json();
        assertTest(resDeleteProdReport.status === 200 && deleteProdData.success === true, 
            `Xóa báo cáo sản phẩm ID: ${createdProdReportId} thành công`);

        console.log(`\n--- TEST 12: Xóa báo cáo đơn hàng vừa tạo (DELETE /reports/orders/${createdOrderReportId}) ---`);
        const resDeleteOrderReport = await fetch(`http://localhost:5003/reports/orders/${createdOrderReportId}`, {
            method: 'DELETE',
            headers
        });
        const deleteOrderData = await resDeleteOrderReport.json();
        assertTest(resDeleteOrderReport.status === 200 && deleteOrderData.success === true, 
            `Xóa báo cáo đơn hàng ID: ${createdOrderReportId} thành công`);

        console.log(`\n--- TEST 13: Kiểm tra báo cáo đơn hàng đã xóa (GET /reports/orders/${createdOrderReportId}) ---`);
        const resCheckDeletedOrder = await fetch(`http://localhost:5003/reports/orders/${createdOrderReportId}`, { headers });
        assertTest(resCheckDeletedOrder.status === 404, `Xác nhận báo cáo đơn hàng không còn tồn tại (Status: 404)`);

        console.log(`\n--- TEST 14: Kiểm tra báo cáo sản phẩm đã xóa (GET /reports/products/${createdProdReportId}) ---`);
        const resCheckDeletedProd = await fetch(`http://localhost:5003/reports/products/${createdProdReportId}`, { headers });
        assertTest(resCheckDeletedProd.status === 404, `Xác nhận báo cáo sản phẩm không còn tồn tại (Status: 404)`);

    } catch (err) {
        console.error('Lỗi khi thực hiện kiểm thử:', err);
    } finally {
        console.log(`\n================================================================`);
        console.log(`KẾT QUẢ KIỂM THỬ TỔNG HỢP: ${passedTests}/${totalTests} TESTS ĐẠT YÊU CẦU`);
        console.log(`================================================================`);

        // Dọn dẹp process
        authProcess.kill();
        productProcess.kill();
        orderProcess.kill();
        reportProcess.kill();
        process.exit(passedTests === totalTests ? 0 : 1);
    }
}

runTests();
