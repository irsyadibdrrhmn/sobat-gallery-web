export async function onRequestGet(context) {
  const { request, env } = context;
  const urlObj = new URL(request.url);
  const id = urlObj.searchParams.get("id");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (!id) {
    return new Response(JSON.stringify({ error: "Parameter id wajib disertakan" }), {
      status: 400,
      headers,
    });
  }

  const apiKey = env?.GDRIVE_API_KEY || (typeof process !== "undefined" && process.env?.GDRIVE_API_KEY);
  if (!apiKey) {
    console.error("GDRIVE_API_KEY is not configured");
    return new Response(JSON.stringify({ error: "Layanan galeri belum dikonfigurasi" }), {
      status: 503,
      headers,
    });
  }

  try {
    const driveUrl = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
    );
    driveUrl.searchParams.set("alt", "media");
    driveUrl.searchParams.set("key", apiKey);

    const driveRes = await fetch(driveUrl);

    if (!driveRes.ok) {
      console.error("Google Drive manifest request failed:", driveRes.status);
      return new Response(JSON.stringify({ error: "Manifest tidak dapat diakses" }), {
        status: driveRes.status,
        headers,
      });
    }

    const data = await driveRes.text();

    return new Response(data, {
      status: 200,
      headers: {
        ...headers,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("Google Drive manifest request error:", err);
    return new Response(JSON.stringify({ error: "Gagal menghubungi Google Drive" }), {
      status: 502,
      headers,
    });
  }
}

