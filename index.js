const fs = require('fs');
const { CHUNK_SIZE, DELAY_BETWEEN_CHUNKS, IGNORE_HISTORY, redeemCode } = require('./config');

/**
 * CodeFilter: Cơ chế lọc thông minh để bỏ qua các mã đã xử lý.
 */
class CodeFilter {
    constructor() {
        this.knownCodes = new Set();
        this.loadHistory();
    }

    loadHistory() {
        ['./success.json', './failure.json'].forEach(file => {
            if (fs.existsSync(file)) {
                try {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.trim()) {
                        const data = JSON.parse(content);
                        if (Array.isArray(data)) {
                            data.forEach(item => {
                                // Chuẩn hóa mã (trim và uppercase) để so sánh chính xác
                                const code = (item.cdkey || item.code || "").toString().replace(/["\u200b\u200c\u200d\uFEFF]/g, '').trim().toUpperCase();
                                if (code) this.knownCodes.add(code);
                            });
                        }
                    }
                } catch (e) {
                    console.error(`⚠️ Không thể đọc lịch sử từ ${file}: ${e.message}`);
                }
            }
        });
    }

    shouldSkip(code) {
        return this.knownCodes.has(code.trim().toUpperCase());
    }
}


async function start() {
    const codeFilePath = './code.txt';
    if (!fs.existsSync(codeFilePath)) {
        console.error("❌ Không tìm thấy file code.txt.");
        return;
    }

    // 1. Khởi tạo bộ lọc lịch sử
    const filter = new CodeFilter();

    // 2. Đọc và làm sạch danh sách mã
    const fileContent = fs.readFileSync(codeFilePath, 'utf8');
    const allLines = fileContent.split(/\r?\n/)
        .map(line => line.replace(/["\u200b\u200c\u200d\uFEFF]/g, '').trim().split(/[\s\t]+/)[0])
        .filter(code => code && code.length > 0);

    // CHỐNG TRÙNG LẶP: Chỉ giữ lại mã xuất hiện đầu tiên (không phân biệt hoa thường)
    const uniqueInFile = [];
    const seenInFile = new Set();
    for (const code of allLines) {
        const upper = code.toUpperCase();
        if (!seenInFile.has(upper)) {
            seenInFile.add(upper);
            uniqueInFile.push(code);
        }
    }

    // 3. Lọc bỏ các mã đã có trong lịch sử (nếu IGNORE_HISTORY = false)
    const codes = IGNORE_HISTORY ? uniqueInFile : uniqueInFile.filter(code => !filter.shouldSkip(code));
    const duplicatesCount = allLines.length - uniqueInFile.length;
    const skippedCount = uniqueInFile.length - codes.length;

    console.log(`🚀 Tổng số dòng trong file: ${allLines.length}`);
    if (IGNORE_HISTORY) console.log(`🔄 Chế độ IGNORE_HISTORY đang BẬT: Sẽ chạy lại tất cả mã.`);
    if (duplicatesCount > 0) console.log(`♻️  Đã loại bỏ ${duplicatesCount} mã trùng lặp trong file.`);
    if (!IGNORE_HISTORY && skippedCount > 0) console.log(`⏩ Tự động bỏ qua ${skippedCount} mã đã có trong lịch sử (failure/success).`);

    console.log(`🎯 Số mã thực tế sẽ chạy: ${codes.length}`);

    if (codes.length === 0) {
        console.log("✨ Không có mã mới nào cần kiểm tra. Hoàn tất!");
        return;
    }

    // 4. Đọc dữ liệu cũ để tránh ghi đè
    let successes = [];
    let failures = [];
    try {
        if (fs.existsSync('./success.json')) successes = JSON.parse(fs.readFileSync('./success.json', 'utf8') || "[]");
        if (fs.existsSync('./failure.json')) failures = JSON.parse(fs.readFileSync('./failure.json', 'utf8') || "[]");
    } catch (e) {
        console.warn("⚠️ Dữ liệu JSON cũ bị lỗi, bắt đầu lưu mới.");
    }

    const startTime = Date.now();

    // 4. Thực thi
    for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
        const chunk = codes.slice(i, i + CHUNK_SIZE);
        console.log(`\n📦 Nhóm ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(codes.length / CHUNK_SIZE)}: [${chunk.join(', ')}]`);

        const results = await Promise.allSettled(chunk.map(code => redeemCode(code)));

        results.forEach((res) => {
            const { cdkey, result, error } = res.value;

            if (error) {
                console.log(`   ❌ [${cdkey}] Lỗi mạng: ${error}`);
                failures.push({ cdkey, reason: "Network Error", details: error });
            } else if (result.code === 0) {
                console.log(`   ✅ [${cdkey}] THÀNH CÔNG!`);
                successes.push({ cdkey, message: result.msg, data: result.data });
            } else {
                console.log(`   ❌ [${cdkey}] Thất bại: ${result.msg}`);
                failures.push({ cdkey, message: result.msg, response_code: result.code });
            }
        });

        if (i + CHUNK_SIZE < codes.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
        }
    }

    // 5. Lưu lại dữ liệu hợp nhất (Chỉ khi không ở chế độ IGNORE_HISTORY)
    if (!IGNORE_HISTORY) {
        fs.writeFileSync('./success.json', JSON.stringify(successes, null, 4));
        fs.writeFileSync('./failure.json', JSON.stringify(failures, null, 4));
        console.log(`\n💾 Đã cập nhật kết quả vào success.json và failure.json`);
    } else {
        console.log(`\n    [Chế độ IGNORE_HISTORY] Kết quả không được lưu vào file.`);
    }

    const endTime = Date.now();
    console.log(`\n================================`);
    console.log(`🏁 Hoàn tất trong ${(endTime - startTime) / 1000} giây!`);
    console.log(`- Mã mới đã xử lý: ${codes.length}`);
    console.log(`- Tổng lịch sử hiện tại: Success(${successes.length}) | Failure(${failures.length})`);
    console.log(`================================`);
}

start();
