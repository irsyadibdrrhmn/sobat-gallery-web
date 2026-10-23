export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const { url, id, filename, inline } = req.query;

  if (!url && !id) {
    return res.status(400).send("URL or ID parameter is required");
  }

  let fileId = id || "";
  let decodedUrl = "";
  if (url) {
    try {
      decodedUrl = decodeURIComponent(url);
    } catch (e) {
      decodedUrl = url;
    }
  }
  if (!fileId && decodedUrl) {
    const idMatch =
      decodedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      decodedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      fileId = idMatch[1];
    }
  }

  const safeFilename = (filename || "photo.jpg").replace(/["\r\n]/g, "_");
  const apiKey = process.env.GDRIVE_API_KEY;
  if (!apiKey) {
    console.error("GDRIVE_API_KEY is not configured");
    return res.status(503).send("Layanan galeri belum dikonfigurasi");
  }

  const lowerName = safeFilename.toLowerCase();
  const fallbackContentType = lowerName.endsWith(".mp4")
    ? "video/mp4"
    : lowerName.endsWith(".gif")
      ? "image/gif"
      : lowerName.endsWith(".png")
        ? "image/png"
        : "image/jpeg";

  try {
    let response = null;

    // 1. Ambil resolusi penuh via Google Drive API v3 (alt=media) menggunakan API key aman di server
    if (fileId) {
      try {
        const driveUrl = new URL(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
        );
        driveUrl.searchParams.set("alt", "media");
        driveUrl.searchParams.set("key", apiKey);

        const apiRes = await fetch(driveUrl);
        if (apiRes.ok) {
          response = apiRes;
        } else {
          console.error("Google Drive API response not ok:", apiRes.status);
        }
      } catch (err) {
        console.error("Google Drive API fetch error:", err);
      }
    }

    // 2. Fallback ke decodedUrl langsung jika fileId gagal atau tidak ada
    if (!response && decodedUrl) {
      try {
        const directRes = await fetch(decodedUrl);
        if (directRes.ok) {
          response = directRes;
        }
      } catch (err) {
        console.error("Direct fetch fallback error:", err);
      }
    }

    if (!response || !response.ok) {
      return res.status(response ? response.status : 404).send("File tidak dapat diakses di Google Drive");
    }

    let contentType = response.headers.get("content-type") || "";
    if (
      !contentType ||
      contentType === "application/octet-stream" ||
      contentType.includes("text/html")
    ) {
      contentType = fallbackContentType;
    }

    const arrayBuffer = await response.arrayBuffer();

    const isInline = inline === "1" || inline === "true";
    const dispositionType = isInline ? "inline" : "attachment";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `${dispositionType}; filename="${safeFilename}"`,
    );
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Download handler error:", err);
    return res.status(502).send("Gagal menghubungi Google Drive");
  }
}
