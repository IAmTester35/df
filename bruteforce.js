const fs = require('fs');
const { redeemCode, CHUNK_SIZE, DELAY_BETWEEN_CHUNKS } = require('./config');

/**
 * BruteForce: Thử lại tất cả các code từ lịch sử (success & failure)
 * Mục đích: Kiểm tra xem có code nào trước đó thất bại nhưng giờ hoạt động lại không,
 * hoặc kiểm tra tính hợp lệ hiện tại của toàn bộ danh sách.
 */
async function startBruteForce() {
    const files = ['./success.json', './failure.json'];
    let allCodes = new Set();
    const excludeCodes = [51, 400070, 400054, 400068]; // Remove code from error [system error, The end time has passed, The current cdk does not match, The current cdkey has reached the redemption limit]

    // 1. Thu thập tất cả code từ các file JSON
    files.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                const data = JSON.parse(fs.readFileSync(file, 'utf8') || "[]");
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        const code = (item.cdkey || item.code || "").toString().replace(/["\u200b\u200c\u200d\FEFF]/g, '').trim();

                        const oldResponseCode = item.response_code || item.code;

                        if (code && !excludeCodes.includes(Number(oldResponseCode))) {
                            allCodes.add(code);
                        }
                    });
                }
            } catch (e) {
                console.error(`⚠️ Lỗi khi đọc file ${file}: ${e.message}`);
            }
        }
    });

    const codesToTry = Array.from(allCodes);
    console.log(`🔍 Tìm thấy tổng cộng ${codesToTry.length} mã duy nhất để thử lại.`);

    if (codesToTry.length === 0) {
        console.log("✨ Không có mã nào để kiểm tra.");
        return;
    }

    let successCount = 0;
    const startTime = Date.now();

    // 2. Chạy brute force theo từng đợt (chunk) dựa trên config
    for (let i = 0; i < codesToTry.length; i += CHUNK_SIZE) {
        const chunk = codesToTry.slice(i, i + CHUNK_SIZE);
        console.log(`\n📦 Đang thử nhóm ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(codesToTry.length / CHUNK_SIZE)}...`);

        const results = await Promise.allSettled(chunk.map(code => redeemCode(code)));

        results.forEach((res) => {
            const { cdkey, result, error } = res.value;

            if (error) {
                console.log(`   ❌ [${cdkey}] Lỗi mạng: ${error}`);
            } else if (result.code === 0) {
                console.log(`   ✅ [${cdkey}] HOẠT ĐỘNG! - ${result.msg}`);
                successCount++;
            } else {
                console.log(`   ➖ [${cdkey}] Vẫn không hoạt động: ${result.msg}`);
            }
        });

        // Nghỉ giữa các đợt để tránh bị rate limit
        if (i + CHUNK_SIZE < codesToTry.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
        }
    }

    const endTime = Date.now();
    console.log(`\n================================`);
    console.log(`🏁 Hoàn tất Brute Force trong ${(endTime - startTime) / 1000} giây!`);
    console.log(`🎯 Số mã hoạt động thành công: ${successCount} / ${codesToTry.length}`);
    console.log(`================================`);
}

startBruteForce();
