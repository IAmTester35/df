/**
 * SCRIPT: Đồng bộ dữ liệu từ Firebase RTDB về local success.json
 * Dùng Database Secret từ secret.txt để truy cập RTDB.
 */
const fs = require('fs');
const path = require('path');

const successFile = path.resolve(__dirname, 'success.json');
const secretFile = path.resolve(__dirname, 'secret.txt');
const envFile = path.resolve(__dirname, './DF-RedeemCode/.env.local');

function unescapeFirebaseKey(key) {
    if (!key) return '';
    return key.toString()
        .replace(/%2E/g, '.')
        .replace(/%23/g, '#')
        .replace(/%24/g, '$')
        .replace(/%2F/g, '/')
        .replace(/%5B/g, '[')
        .replace(/%5D/g, ']');
}

// 1. Tải Firebase Config từ .env.local (để lấy databaseURL)
const envContent = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const firebaseConfig = {};
envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) {
        const rawKey = k.trim().replace('VITE_FIREBASE_', '').toLowerCase()
            .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        let finalKey = rawKey;
        if (rawKey === 'databaseUrl') finalKey = 'databaseURL';
        firebaseConfig[finalKey] = v.trim();
    }
});

const DB_URL = firebaseConfig.databaseURL;
if (!DB_URL) {
    console.error("❌ Không tìm thấy databaseURL trong .env.local");
    process.exit(1);
}

// 2. Tải Secret từ secret.txt
if (!fs.existsSync(secretFile)) {
    console.error("❌ Không tìm thấy file secret.txt");
    process.exit(1);
}
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();

async function syncToLocal() {
    console.log(`🚀 Bắt đầu đồng bộ từ RTDB: ${DB_URL}`);
    
    try {
        // 3. Fetch dữ liệu từ RTDB (node 'c')
        const fetchUrl = `${DB_URL.replace(/\/$/, '')}/c.json?auth=${SECRET}`;
        const response = await fetch(fetchUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const rtdbData = await response.json();
        if (!rtdbData) {
            console.log("ℹ️ RTDB không có dữ liệu (node 'c').");
            return;
        }

        // 4. Đọc success.json hiện tại
        let successList = [];
        if (fs.existsSync(successFile)) {
            try {
                successList = JSON.parse(fs.readFileSync(successFile, 'utf8') || "[]");
            } catch (e) {
                console.warn("⚠️ success.json bị lỗi định dạng, khởi tạo mảng mới.");
            }
        }

        const existingKeys = new Set(successList.map(item => item.cdkey.toUpperCase()));
        const newlyAdded = [];

        // 5. Lọc và thêm CDKey mới
        // Status 0: Success, Status 1: Limit (tương đương cdkey còn hoạt động)
        Object.entries(rtdbData).forEach(([safeKey, val]) => {
            const statusDigit = val % 10;
            if (statusDigit === 0 || statusDigit === 1) {
                const cdkey = unescapeFirebaseKey(safeKey).trim();
                const upperKey = cdkey.toUpperCase();
                
                if (!existingKeys.has(upperKey)) {
                    const newItem = {
                        cdkey: cdkey,
                        message: "ok",
                        data: {}
                    };
                    successList.push(newItem);
                    newlyAdded.push(cdkey);
                    existingKeys.add(upperKey);
                }
            }
        });

        if (newlyAdded.length === 0) {
            console.log("✨ Không có cdkey mới nào cần cập nhật.");
            return;
        }

        // 6. Ghi file ATOMIC (Ghi file tạm sau đó rename)
        const tempPath = successFile + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(successList, null, 4), 'utf8');
        fs.renameSync(tempPath, successFile);

        console.log(`\n✅ Đã cập nhật ${newlyAdded.length} cdkey mới vào success.json:`);
        newlyAdded.forEach(k => console.log(`   - ${k}`));
        
    } catch (error) {
        console.error("❌ Lỗi trong quá trình đồng bộ:", error.message);
    }
}

syncToLocal();
