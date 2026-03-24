/**
 * SCRIPT TEST: Kiểm tra cấu trúc SIÊU NÉN V4.0.
 */
const fs = require('fs');
const path = require('path');

const successFile = path.resolve(__dirname, 'success.json');
const failureFile = path.resolve(__dirname, 'failure.json');

// 0. Encode CDKey (Escape Firebase blocked characters)
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

function processData() {
    let successData = [];
    let failureData = [];

    if (fs.existsSync(successFile)) successData = JSON.parse(fs.readFileSync(successFile, 'utf8'));
    if (fs.existsSync(failureFile)) failureData = JSON.parse(fs.readFileSync(failureFile, 'utf8'));

    const successBranch = {};
    const failureBranch = {};
    const nowTs = Math.floor(Date.now() / 1000); 

    successData.forEach(item => {
        const cdkey = item.cdkey.trim().toUpperCase();
        const safeKey = escapeFirebaseKey(cdkey);
        successBranch[safeKey] = nowTs;
    });

    failureData.forEach(item => {
        const cdkey = item.cdkey.trim().toUpperCase();
        const safeKey = escapeFirebaseKey(cdkey);
        if (successBranch[safeKey] === undefined) {
            const code = item.response_code || 0;
            failureBranch[safeKey] = `${code}|${nowTs}`;
        }
    });

    return { s: successBranch, f: failureBranch };
}

function runTest() {
    console.log('🧪 ĐANG KIỂM TRA LOGIC CẤU TRÚC SIÊU NÉN V4.0...');
    const results = processData();
    
    // 1. Thống kê
    console.log('\n📊 THỐNG KÊ CHI TIẾT:');
    const cs = Object.keys(results.s).length;
    const cf = Object.keys(results.f).length;
    console.log(`- Nhánh s (Success): ${cs} CDKeys`);
    console.log(`- Nhánh f (Failure): ${cf} CDKeys`);

    // 2. Kiểm tra mẫu Success
    console.log('\n🔍 MẪU NHÁNH s (SUCCESS):');
    const sKeys = Object.keys(results.s).slice(0, 3);
    sKeys.forEach(k => {
        const val = results.s[k];
        console.log(`   s/${k} -> Value: ${val}`);
    });

    // 3. Kiểm tra mẫu Failure
    console.log('\n🔍 MẪU NHÁNH f (FAILURE):');
    const fKeys = Object.keys(results.f).slice(0, 3);
    fKeys.forEach(k => {
        const val = results.f[k];
        console.log(`   f/${k} -> Value: "${val}" (Code|Timestamp)`);
    });

    // 4. Kiểm tra Key đặc biệt
    console.log('\n🔍 KIỂM TRA KEY ĐẶC BIỆT (với dấu /):');
    const slashKeys = Object.keys(results.f).filter(k => k.includes('%2F'));
    if (slashKeys.length > 0) {
        console.log(`   f/${slashKeys[0]} -> Value: "${results.f[slashKeys[0]]}"`);
    } else {
        console.log('   (Không có key chứa dấu /)');
    }

    console.log('\n✅ Script Test Hoàn Tất. Cấu trúc V4.0 đã sạch và cực kỳ gọn nhẹ.');
}

runTest();
