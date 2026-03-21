const fs = require('fs');
const path = require('path');

const successFile = path.join(__dirname, 'success.json');
const failureFile = path.join(__dirname, 'failure.json');

function generateStats() {
    try {
        const successData = JSON.parse(fs.readFileSync(successFile, 'utf8'));
        const failureData = JSON.parse(fs.readFileSync(failureFile, 'utf8'));

        console.log('\x1b[36m%s\x1b[0m', '==================================================');
        console.log('\x1b[32m%s\x1b[0m', '            CDKEY REDEMPTION STATISTICS            ');
        console.log('\x1b[36m%s\x1b[0m', '==================================================');

        console.log(`\x1b[1mSummary:\x1b[0m`);
        console.log(`- Total Success: \x1b[32m${successData.length}\x1b[0m`);
        console.log(`- Total Failure: \x1b[31m${failureData.length}\x1b[0m`);
        console.log(`- Total Attempted: \x1b[36m${successData.length + failureData.length}\x1b[0m`);

        // --- SUCCESS CODES ---
        if (successData.length > 0) {
            console.log('\n\x1b[32m--- SUCCESSFUL CODES ---\x1b[0m');
            const successKeys = successData.map(d => d.cdkey);
            console.log(`  ${successKeys.join(', ')}`);
        } else {
            console.log('\n\x1b[32m--- NO SUCCESSFUL CODES ---\x1b[0m');
        }

        // --- FAILURE REASONS ---
        console.log('\n\x1b[31m--- FAILURE REASONS BREAKDOWN ---\x1b[0m');
        
        const errorGroups = {};
        failureData.forEach(item => {
            const msg = item.message || 'Unknown Error';
            if (!errorGroups[msg]) errorGroups[msg] = [];
            errorGroups[msg].push(item.cdkey);
        });

        // Sort errors by count descending
        const sortedErrors = Object.entries(errorGroups).sort((a, b) => b[1].length - a[1].length);

        sortedErrors.forEach(([msg, codes]) => {
            const count = codes.length;
            const percentage = ((count / failureData.length) * 100).toFixed(2);
            console.log(`\n\x1b[33m${msg}\x1b[0m: \x1b[1m${count}\x1b[0m (${percentage}%)`);
            if (count <= 10) {
                console.log(`  \x1b[90mCodes:\x1b[0m ${codes.join(', ')}`);
            } else {
                console.log(`  \x1b[90mExample Codes:\x1b[0m ${codes.slice(0, 10).join(', ')} ... (\x1b[2m+${count-10} more\x1b[0m)`);
            }
        });

        console.log('\x1b[36m%s\x1b[0m', '\n==================================================');

    } catch (error) {
        console.error('\x1b[31mError reading or parsing files:\x1b[0m', error.message);
    }
}

generateStats();
