/**
 * SCRIPT: Đồng bộ dữ liệu lên Firebase RTDB - V5.2 (Ultra-Compact)
 * Cấu trúc: node 'c' | Value: Timestamp * 10 + Status (0: Success, 1: Limit)
 */
const fs = require('fs');
const path = require('path');

const successFile = path.resolve(__dirname, 'success.json');
const failureFile = path.resolve(__dirname, 'failure.json');
const envFile = path.resolve(__dirname, 'DF-RedeemCode/.env.local');

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
        const key = k.trim().replace('VITE_FIREBASE_', '').toLowerCase()
            .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        firebaseConfig[key === 'apiKey' ? 'apiKey' : key] = v.trim();
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

    // 1. Success (Status 0)
    if (fs.existsSync(successFile)) {
        const data = JSON.parse(fs.readFileSync(successFile, 'utf8') || "[]");
        data.forEach(item => {
            const safeKey = escapeFirebaseKey(item.cdkey.trim().toUpperCase());
            codes[safeKey] = nowTs * 10 + 0;
        });
    }

    // 2. Limit 400067 (Status 1)
    if (fs.existsSync(failureFile)) {
        const data = JSON.parse(fs.readFileSync(failureFile, 'utf8') || "[]");
        data.forEach(item => {
            const safeKey = escapeFirebaseKey(item.cdkey.trim().toUpperCase());
            if (Number(item.response_code) === 400067 && !codes[safeKey]) {
                codes[safeKey] = nowTs * 10 + 1;
            }
        });
    }
    return codes;
}

async function sync() {
    console.log('🚀 Preparing V5.2 Ultra-Compact Data...');
    const data = processV52Data();
    const count = Object.keys(data).length;

    if (process.argv.includes('--dry-run')) {
        console.log(`[DRY RUN] Would sync ${count} keys to node 'c'. Sample:`, Object.entries(data)[0]);
        return;
    }

    try {
        const { initializeApp } = require('firebase/app');
        const { getDatabase, ref, update } = require('firebase/database');

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        
        console.log(`🔗 Syncing ${count} keys to 'c' via Multi-path Update...`);
        // Sử dụng update để không xóa các node metadata khác (nếu có)
        await update(ref(db), { 'c': data });
        console.log('✅ Done!');
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        process.exit(0);
    }
}

sync();
