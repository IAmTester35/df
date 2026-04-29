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
            await new Promise(r => setTimeout(r, 200));
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

      let result;
      try {
        result = await garenaResponse.json();
      } catch (e) {
        return { 
          original: { code: -2, message: "Garena Server Busy (Non-JSON)" }, 
          finalStatus: 502 
        };
      }

      let finalStatus = garenaResponse.status;

      if (result.code === 0 || String(result.code) === "400067") {
        const statusDigit = result.code === 0 ? 0 : 1;
        const GAS_URL = env.GAS_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbzKx5iFDII-yjbhTsCxFrWRUFff20aJJjBilVQn-B7n6c8RuIUWDo54_yY3VklYQQCV/exec";
        const params = new URLSearchParams({ cdkey, status: String(statusDigit), timestamp: String(Math.floor(Date.now() / 1000)) });
        const finalGasUrl = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}${params.toString()}`;
        
        ctx.waitUntil(fetch(finalGasUrl).catch(() => {}));
      }

      if (result.code !== 0 && finalStatus === 200) finalStatus = 400;

      return { original: result, finalStatus };
    } catch (e) {
      return { 
        original: { code: -2, message: "Garena Connection Failed: " + e.message }, 
        finalStatus: 504 
      };
    }
  }
};

