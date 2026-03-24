/**
 * Cloudflare Worker: Delta Force Auto-Redeem Proxy Gateway
 * Architecture: V6.0 - Zero-Config Centralized Proxy
 * 
 * Logic:
 * 1. Receive Redeem POST from Client (contains cdkey and masterUrl)
 * 2. Reconstruct the actual Garena target URL from masterUrl
 * 3. Forward to Garena Official API
 * 4. If Response is Success (0) or Limit (400067), forward to Google Apps Script (GAS)
 * 5. Return original Garena response to Client
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Referer",
    };

    // 1. Handle Preflight Options (CORS)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const input = await request.json();
      const { masterUrl, cdkey, ...restBody } = input;

      if (!masterUrl || !cdkey) {
        throw new Error("Missing masterUrl or cdkey in request body");
      }

      // 2. Prepare Target Request (Zero-Config: Lấy target từ chính masterUrl client gửi lên)
      // Thay thế cdkey trong masterUrl để ra URL đích thực tế
      const targetUrl = masterUrl.replace(/cdkey=[^&]*/, `cdkey=${cdkey}`);
      
      const garenaResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Referer": "https://redeem.df.garena.sg/",
          "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
        },
        body: JSON.stringify({ ...restBody, cdkey }), // Forward body clean
      });

      const result = await garenaResponse.json();

      // 3. Status Determination (V5.2 Logic)
      // code 0: Success, code 400067: Limit reached
      let statusDigit = -1;
      if (result.code === 0) {
        statusDigit = 0;
      } else if (String(result.code) === "400067") {
        statusDigit = 1;
      }

      // 4. Async Hook to Google Apps Script (GAS)
      // Sử dụng Webhook URL đã cung cấp
      const GAS_URL = env.GAS_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbzKx5iFDII-yjbhTsCxFrWRUFff20aJJjBilVQn-B7n6c8RuIUWDo54_yY3VklYQQCV/exec";
      
      if (statusDigit !== -1) {
        ctx.waitUntil(
          fetch(GAS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cdkey: cdkey,
              status: statusDigit,
              raw_code: result.code,
              message: result.message || "",
              timestamp: Math.floor(Date.now() / 1000)
            }),
          }).catch(e => console.error("GAS Webhook Error:", e))
        );
      }

      // 5. Return Garena response to Frontend
      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ 
        code: -1, 
        message: "Proxy Error: " + err.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
