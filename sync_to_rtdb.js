/**
 * SCRIPT: Đồng bộ danh sách success.json và failure.json lên Firebase RTDB.
 * Cấu trúc V4.0: Siêu Nén (Compressed Shorthand Values & Keys).
 */
const fs = require('fs');
const path = require('path');

// --- CẤU HÌNH ---
const successFile = path.resolve(__dirname, 'success.json');
const failureFile = path.resolve(__dirname, 'failure.json');
const envFile = path.resolve(__dirname, 'DF-RedeemCode/.env.local');

// 0. Encode CDKey để làm Firebase Key (Loại bỏ các ký tự bị cấm như ., #, $, /, [, ])
function escapeFirebaseKey(key) {
    if (!key) return '';
    return key.toString()
        .replace(/\./g, '%2E')
        .replace(/#/g, '%23')
        .replace(/\$/g, '%24')
        .replace(/\//g, '%2F')
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D');
}

// 1. Module Path Setup
const nodeModulesPath = path.resolve(__dirname, 'DF-RedeemCode/node_modules');
if (fs.existsSync(nodeModulesPath)) {
    module.paths.push(nodeModulesPath);
}

// 2. Parse Environment Variables
function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    content.split('\n').filter(l => l.includes('=')).forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim();
    });
    return env;
}

const env = loadEnv(envFile);
const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

/**
 * CẤU TRÚC V4.0 (SIÊU NÉN):
 * s (Success): { "SAFE_KEY": UnixTimestamp }
 * f (Failure): { "SAFE_KEY": "Code|UnixTimestamp" }
 */
function processData() {
    let successData = [];
    let failureData = [];

    if (fs.existsSync(successFile)) successData = JSON.parse(fs.readFileSync(successFile, 'utf8'));
    if (fs.existsSync(failureFile)) failureData = JSON.parse(fs.readFileSync(failureFile, 'utf8'));

    const successBranch = {};
    const failureBranch = {};
    const nowTs = Math.floor(Date.now() / 1000); // Unix timestamp để ngắn hơn ISO string

    // Success
    successData.forEach(item => {
        const cdkey = item.cdkey.trim().toUpperCase();
        const safeKey = escapeFirebaseKey(cdkey);
        successBranch[safeKey] = nowTs;
    });

    // Failure
    failureData.forEach(item => {
        const cdkey = item.cdkey.trim().toUpperCase();
        const safeKey = escapeFirebaseKey(cdkey);
        
        // Không ghi đè nếu đã thành công
        if (successBranch[safeKey] === undefined) {
            const code = item.response_code || 0;
            // Nén Code và Timestamp vào một chuỗi dùng dấu gạch đứng
            failureBranch[safeKey] = `${code}|${nowTs}`;
        }
    });

    return {
        s: successBranch,
        f: failureBranch
    };
}

async function syncToFirebase() {
    console.log('🚀 Đang chuẩn bị dữ liệu cấu trúc SIÊU NÉN V4.0...');
    const fullData = processData();
    const countSuccess = Object.keys(fullData.s).length;
    const countFailure = Object.keys(fullData.f).length;

    if (process.argv.includes('--dry-run')) {
        console.log('--- DRY RUN MODE (V4.0) ---');
        console.log(`- Nhánh s (Success): ${countSuccess} keys`);
        console.log(`- Nhánh f (Failure): ${countFailure} keys`);
        console.log('Mẫu s (Success):', Object.entries(fullData.s)[0]);
        console.log('Mẫu f (Failure):', Object.entries(fullData.f)[0]);
        return;
    }

    try {
        const { initializeApp } = require('firebase/app');
        const { getDatabase, ref, set } = require('firebase/database');

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        
        console.log('🔗 Đang GHI ĐÈ dữ liệu cấu trúc V4.0 lên RTDB...');
        
        // Ghi đè node 'codes' với cấu trúc s/f thu gọn
        await set(ref(db, 'codes'), fullData);
        
        console.log('✅ Hoàn tất! Dữ liệu đã được nén tối đa và ghi đè thành công.');
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        process.exit(0);
    }
}

syncToFirebase();
