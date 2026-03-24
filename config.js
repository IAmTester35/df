const FULL_URL = "https://sg-act.playerinfinite.com/api/proxy/present/CdkV2/RedeemCDKey?cdkey=12312&channel=10&game_id=30150&gameid=30150&openid=6762653709957283006&token=53c80bf766d7ed618e0b163cae0f7377adc3fc2c&account_type=1&lang_type=en&u=3fe9c8e7-0381-47f4-a50c-b0b28b40165c&a=10005&ts=1774336014&s=73bd86c69f177956c152cc483a887f31";

// Trích xuất config từ FULL_URL
const urlParams = new URL(FULL_URL).searchParams;
const API_CONFIG = {
    channel: urlParams.get("channel"),
    game_id: urlParams.get("game_id"),
    openid: urlParams.get("openid"),
    token: urlParams.get("token"),
    account_type: urlParams.get("account_type"),
    lang_type: urlParams.get("lang_type"),
    u: urlParams.get("u"),
    a: urlParams.get("a"),
    ts: urlParams.get("ts"),
    s: urlParams.get("s")
};

const CHUNK_SIZE = 1;
const DELAY_BETWEEN_CHUNKS = 100;
const IGNORE_HISTORY = false;

async function redeemCode(cdkey) {
    const urlObj = new URL(FULL_URL);
    urlObj.searchParams.set('cdkey', cdkey);
    const url = urlObj.toString();
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json",
                "Referer": "https://redeem.df.garena.sg/"
            },
            body: JSON.stringify({
                lang_type: API_CONFIG.lang_type,
                role_info: { game_id: API_CONFIG.game_id },
                cdkey: cdkey
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        return { cdkey, result };
    } catch (error) {
        return { cdkey, error: error.message };
    }
}

module.exports = {
    API_CONFIG,
    CHUNK_SIZE,
    DELAY_BETWEEN_CHUNKS,
    IGNORE_HISTORY,
    redeemCode
};
