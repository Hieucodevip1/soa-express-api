const { spawn } = require('child_process');

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('--- BẮT ĐẦU KIỂM THỬ HỆ THỐNG SOA BÀI 3 ---');

    // 1. Khởi chạy Auth Service (Bài 2)
    const authProcess = spawn('node', ['server.js'], { stdio: 'pipe' });
    authProcess.stdout.on('data', data => console.log(`[Auth Service 5000]: ${data.toString().trim()}`));
    authProcess.stderr.on('data', data => console.error(`[Auth Service ERR]: ${data.toString().trim()}`));

    // 2. Khởi chạy Product Service (Bài 3)
    const productProcess = spawn('node', ['product-service.js'], { stdio: 'pipe' });
    productProcess.stdout.on('data', data => console.log(`[Product Service 5001]: ${data.toString().trim()}`));
    productProcess.stderr.on('data', data => console.error(`[Product Service ERR]: ${data.toString().trim()}`));

    // Đợi 2s để 2 server khởi động xong
    await wait(2000);

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
        // Test 1: Truy cập / trên Product Service
        console.log('\n--- TEST 1: Kiểm tra Service Info (GET http://localhost:5001/) ---');
        const resRoot = await fetch('http://localhost:5001/');
        const dataRoot = await resRoot.json();
        assertTest(resRoot.status === 200 && dataRoot.success === true, 'Product Service phản hồi thông tin dịch vụ thành công');

        // Test 2: Gọi GET /products không có token (Kỳ vọng 401)
        console.log('\n--- TEST 2: Gọi GET /products KHÔNG có token ---');
        const resNoAuth = await fetch('http://localhost:5001/products');
        assertTest(resNoAuth.status === 401, `Từ chối truy cập khi không có token (Status: ${resNoAuth.status})`);

        // Test 3: Đăng nhập vào Auth Service (Port 5000) lấy JWT token
        console.log('\n--- TEST 3: Đăng nhập tại Auth Service (POST http://localhost:5000/login) ---');
        const resLogin = await fetch('http://localhost:5000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName: 'admin', password: '123' })
        });
        const loginData = await resLogin.json();
        const token = loginData.token;
        assertTest(resLogin.status === 200 && !!token, 'Lấy token JWT thành công từ Auth Service (Bài 2)');

        // Test 4: Gọi GET /products VỚI token hợp lệ
        console.log('\n--- TEST 4: Gọi GET /products CÓ token JWT từ Bài 2 ---');
        const resGetProducts = await fetch('http://localhost:5001/products', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const productsData = await resGetProducts.json();
        assertTest(resGetProducts.status === 200 && Array.isArray(productsData.data) && productsData.data.length >= 3, 
            `Lấy danh sách sản phẩm thành công (Số lượng: ${productsData.data ? productsData.data.length : 0})`);

        // Test 5: Gọi GET /products/1 xem chi tiết sản phẩm 1
        console.log('\n--- TEST 5: Xem chi tiết sản phẩm 1 (GET /products/1) ---');
        const resGetOne = await fetch('http://localhost:5001/products/1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const oneData = await resGetOne.json();
        assertTest(resGetOne.status === 200 && oneData.data && oneData.data.id === 1, 
            `Lấy chi tiết sản phẩm ID 1 thành công: ${oneData.data ? oneData.data.name : ''}`);

        // Test 6: Thêm sản phẩm mới (POST /products)
        console.log('\n--- TEST 6: Thêm sản phẩm mới (POST /products) ---');
        const newProductBody = {
            name: 'Màn hình Dell UltraSharp 27 inch 4K',
            description: 'Màn hình đồ họa IPS, độ phủ màu 100% sRGB, Type-C 90W',
            price: 13990000.00,
            quantity: 10
        };
        const resCreate = await fetch('http://localhost:5001/products', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(newProductBody)
        });
        const createData = await resCreate.json();
        const createdId = createData.data ? createData.data.id : null;
        assertTest(resCreate.status === 201 && createdId > 0 && createData.data.name === newProductBody.name, 
            `Tạo sản phẩm mới thành công với ID: ${createdId}`);

        // Test 7: Cập nhật sản phẩm vừa tạo (PUT /products/:id)
        console.log(`\n--- TEST 7: Cập nhật sản phẩm vừa tạo (PUT /products/${createdId}) ---`);
        const updateBody = {
            price: 12990000.00,
            quantity: 15
        };
        const resUpdate = await fetch(`http://localhost:5001/products/${createdId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(updateBody)
        });
        const updateData = await resUpdate.json();
        assertTest(resUpdate.status === 200 && updateData.data.price === 12990000.00 && updateData.data.quantity === 15, 
            `Cập nhật giá và số lượng thành công cho sản phẩm ID: ${createdId}`);

        // Test 8: Xóa sản phẩm vừa tạo (DELETE /products/:id)
        console.log(`\n--- TEST 8: Xóa sản phẩm vừa tạo (DELETE /products/${createdId}) ---`);
        const resDelete = await fetch(`http://localhost:5001/products/${createdId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const deleteData = await resDelete.json();
        assertTest(resDelete.status === 200 && deleteData.success === true, 
            `Xóa sản phẩm ID: ${createdId} thành công`);

        // Test 9: Kiểm tra lại sản phẩm đã xóa (GET /products/:id kỳ vọng 404)
        console.log(`\n--- TEST 9: Kiểm tra sản phẩm đã xóa (GET /products/${createdId}) ---`);
        const resCheckDeleted = await fetch(`http://localhost:5001/products/${createdId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        assertTest(resCheckDeleted.status === 404, `Xác nhận sản phẩm ID ${createdId} không còn tồn tại (Status: 404)`);

        // Test 10: Kiểm tra với token sai (Invalid Token)
        console.log('\n--- TEST 10: Kiểm tra với Token sai (Fake Token) ---');
        const resFakeToken = await fetch('http://localhost:5001/products', {
            headers: { 'Authorization': 'Bearer token_sai_hoan_toan_123456' }
        });
        assertTest(resFakeToken.status === 401, `Từ chối token sai thành công (Status: ${resFakeToken.status})`);

    } catch (err) {
        console.error('Lỗi trong quá trình chạy test:', err);
    } finally {
        console.log(`\n========================================`);
        console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS ĐẠT YÊU CẦU`);
        console.log(`========================================`);

        // Dọn dẹp process
        authProcess.kill();
        productProcess.kill();
        process.exit(passedTests === totalTests ? 0 : 1);
    }
}

runTests();
