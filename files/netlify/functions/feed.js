// Netlify serverless function — runs on YOUR Netlify account
// Fetches RSS feeds server-side (no CORS issues, no third-party proxies)
// Endpoint: /.netlify/functions/feed?url=<encoded_rss_url>

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=900', // cache 15 min on CDN
  };

  const feedUrl = event.queryStringParameters?.url;
  if (!feedUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing url param' }) };
  }

  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'TokenWatch/1.0 RSS Reader' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: `Feed returned ${res.status}` }) };
    }

    const xml = await res.text();

    // Parse XML manually — no external dependencies needed
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1] || match[2];

      const get = (tag) => {
        // Handle CDATA and plain text
        const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, 'i');
        const m = block.match(r);
        return (m?.[1] ?? m?.[2] ?? '').trim();
      };

      // link can be an attribute or text content
      let link = get('link');
      if (!link) {
        const linkAttr = block.match(/<link[^>]+href=["']([^"']+)["']/i);
        link = linkAttr?.[1] ?? '';
      }

      const title = get('title').replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
      const pubDate = get('pubDate') || get('published') || get('updated') || get('dc:date') || '';

      if (title) {
        items.push({ title, link, pubDate });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
