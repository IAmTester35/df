export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Referer",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    try {
      const input = await request.json();
      const { masterUrl, cdkey, cdkeys, ...restBody } = input;

      if (!masterUrl) throw new Error("Missing masterUrl");

      // Case 1: Batch processing (Mới - Tiết kiệm chi phí gọi request)
      if (cdkeys && Array.isArray(cdkeys)) {
        const results = [];
        const ua = request.headers.get("User-Agent");
        for (const key of cdkeys) {
          const res = await this.redeemSingle(key, masterUrl, restBody, env, ctx, ua);
          results.push({ cdkey: key, ...res });

          if (res.original && Number(res.original.code) === 300001) break;

          if (cdkeys.indexOf(key) < cdkeys.length - 1) {
            await new Promise(r => setTimeout(r, 230));
          }
        }
        return new Response(JSON.stringify({ codes: results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!cdkey) throw new Error("Missing cdkey");
      const res = await this.redeemSingle(cdkey, masterUrl, restBody, env, ctx, request.headers.get("User-Agent"));

      return new Response(JSON.stringify(res.original), {
        status: res.finalStatus,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(JSON.stringify({ code: -1, message: "Proxy Error: " + err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },

  async redeemSingle(cdkey, masterUrl, restBody, env, ctx, userAgent) {
    const MAX_RETRIES = 2;
    const BASE_DELAY_MS = 800;  // Retry delay bắt đầu từ 800ms

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const targetUrl = masterUrl.replace(/cdkey=[^&]*/, `cdkey=${cdkey}`);
        const garenaResponse = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Referer": "https://redeem.df.garena.sg/",
            "User-Agent": userAgent || "Mozilla/5.0",
          },
          body: JSON.stringify({ ...restBody, cdkey }),
        });

        // Retry on 429 (Too Many Requests) or 5xx server errors
        if (garenaResponse.status === 429 || garenaResponse.status >= 500) {
          if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt); // exponential backoff: 800, 1600, 3200ms
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          // Exhausted retries — return error
          return {
            original: { code: -2, message: `Garena Server Error (HTTP ${garenaResponse.status}) after ${MAX_RETRIES + 1} attempts` },
            finalStatus: garenaResponse.status
          };
        }

        let result;
        try {
          result = await garenaResponse.json();
        } catch (e) {
          if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          return {
            original: { code: -2, message: "Garena Server Busy (Non-JSON)" },
            finalStatus: 502
          };
        }

        let finalStatus = garenaResponse.status;

        const codeNum = result && result.code !== undefined ? Number(result.code) : -1;
        let statusDigit = -1;
        if (codeNum === 0) statusDigit = 0;
        else if (codeNum === 400067) statusDigit = 1;
        else if (codeNum === 400054 || codeNum === 400068 || codeNum === 400070) statusDigit = 2;

        if (statusDigit !== -1) {
          const GAS_URL = env.GAS_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbzKx5iFDII-yjbhTsCxFrWRUFff20aJJjBilVQn-B7n6c8RuIUWDo54_yY3VklYQQCV/exec";
          const params = new URLSearchParams({ cdkey, status: String(statusDigit), timestamp: String(Math.floor(Date.now() / 1000)) });
          const finalGasUrl = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}${params.toString()}`;

          ctx.waitUntil(fetch(finalGasUrl).catch(() => { }));
        }

        if (result.code !== 0 && finalStatus === 200) finalStatus = 400;

        return { original: result, finalStatus };
      } catch (e) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return {
          original: { code: -2, message: "Garena Connection Failed: " + e.message },
          finalStatus: 504
        };
      }
    }
  }
};

