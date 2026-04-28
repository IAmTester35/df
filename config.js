const FULL_URL = "https://sg-act.playerinfinite.com/api/proxy/present/CdkV2/RedeemCDKey?cdkey=123&channel=10&game_id=30150&gameid=30150&openid=6762653709957283006&token=da9d6f83770e9492b3c2e5a6b3d32b98d4ea5315&account_type=1&lang_type=en&u=b95fc825-141a-43cf-bbea-532ace2c892e&a=10005&ts=1777338611&s=f067cfa378ac7a943c9c62bf3cf3c37c";

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
