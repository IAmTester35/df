/**
 * SCRIPT: Đồng bộ dữ liệu lên Firebase RTDB - V5.2 (Ultra-Compact)
 * Cấu trúc: node 'c' | Value: Timestamp * 10 + Status (0: Success, 1: Limit)
 */
const fs = require('fs');
const path = require('path');

const successFile = path.resolve(__dirname, 'success.json');
const failureFile = path.resolve(__dirname, 'failure.json');
const envFile = path.resolve(__dirname, './DF-RedeemCode/.env.local');

function escapeFirebaseKey(key) {
    if (!key) return '';
    return key.toString()
        .replace(/\./g, '%2E').replace(/#/g, '%23').replace(/\$/g, '%24')
        .replace(/\//g, '%2F').replace(/\[/g, '%5B').replace(/\]/g, '%5D');
}

// Load Firebase Config from .env.local
const envContent = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const firebaseConfig = {};
envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) {
        const rawKey = k.trim().replace('VITE_FIREBASE_', '').toLowerCase()
            .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        // Fix naming convention for Firebase SDK
        let finalKey = rawKey;
        if (rawKey === 'databaseUrl') finalKey = 'databaseURL';
        if (rawKey === 'authDomain') finalKey = 'authDomain';

        firebaseConfig[finalKey] = v.trim();
    }
});

/**
 * Filter & Encode Data:
 * - Success -> Status 0
 * - Failure (400067) -> Status 1
 * - Others -> Ignore
 */
function processV52Data() {
    const codes = {};
    const nowTs = Math.floor(Date.now() / 1000);

    let sCount = 0;
    let fCount = 0;

    // 1. Success (Status 0)
    if (fs.existsSync(successFile)) {
        const data = JSON.parse(fs.readFileSync(successFile, 'utf8') || "[]");
        data.forEach(item => {
            const safeKey = escapeFirebaseKey(item.cdkey.trim());
            if (!codes[safeKey]) {
                codes[safeKey] = nowTs * 10 + 0;
                sCount++;
            }
        });
    }

    // 2. Limit 400067 (Status 1)
    if (fs.existsSync(failureFile)) {
        const data = JSON.parse(fs.readFileSync(failureFile, 'utf8') || "[]");
        data.forEach(item => {
            const safeKey = escapeFirebaseKey(item.cdkey.trim());
            const code = Number(item.response_code);
            // 400067: Personal/Account Limit (Status 1)
            if (code === 400067 && !codes[safeKey]) {
                codes[safeKey] = nowTs * 10 + 1;
                fCount++;
            }
        });
    }
    console.log(`📊 Success: ${sCount} | Failure (400067): ${fCount} | Total: ${sCount + fCount}`);
    return codes;
}

async function sync() {
    console.log('🚀 Preparing V5.2 Ultra-Compact Data (via GAS Webhook)...');
    const codes = processV52Data();
    const count = Object.keys(codes).length;
    const nowTs = Math.floor(Date.now() / 1000);

    if (process.argv.includes('--dry-run')) {
        console.log(`[DRY RUN] Would sync ${count} keys via GAS. Sample:`, Object.entries(codes)[0]);
        return;
    }

    const GAS_URL = env.GAS_WEBHOOK_URL;
    console.log(`📡 Sending ${count} keys to GAS Webhook: ${GAS_URL}`);

    // Sử dụng Promise.all với giới hạn concurrency để không làm quá tải GAS
    const limit = 5; // Độ trễ xử lý song song
    const list = Object.entries(codes);
    let completed = 0;

    for (let i = 0; i < list.length; i += limit) {
        const chunk = list.slice(i, i + limit);
        await Promise.all(chunk.map(async ([cdkey, value]) => {
            const status = value % 10;
            const ts = Math.floor(value / 10);

            try {
                // Giống cách Cloudflare Worker gọi GAS
                const params = new URLSearchParams({
                    cdkey: cdkey,
                    status: String(status),
                    timestamp: String(ts)
                });
                const finalUrl = `${GAS_URL}?${params.toString()}`;

                const res = await fetch(finalUrl);
                if (res.ok) {
                    completed++;
                } else {
                    console.error(`❌ Failed: ${cdkey} (HTTP ${res.status})`);
                }
            } catch (err) {
                console.error(`❌ Error syncing ${cdkey}:`, err.message);
            }
        }));

        if (completed % 20 === 0 || completed === count) {
            console.log(`⏳ Progress: ${completed}/${count} keys synced...`);
        }
    }

    console.log(`✅ Finished! ${completed}/${count} keys successfully synced to RTDB via GAS.`);
    process.exit(0);
}

sync();
