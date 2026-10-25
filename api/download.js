export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const { url, id, filename, inline, type } = req.query;

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
  const lowerName = safeFilename.toLowerCase();
  const lowerUrl = decodedUrl.toLowerCase();
  const typeParam = (type || "").toLowerCase();

  const isVideo =
    typeParam === "video" ||
    typeParam === "mp4" ||
    lowerName.endsWith(".mp4") ||
    lowerUrl.includes(".mp4") ||
    lowerUrl.includes("ext=.mp4");

  let redirectTarget = "";

  if (fileId) {
    // Untuk video MP4 gunakan uc?export=download, untuk foto gunakan direct CDN lh3.googleusercontent.com/d/
    redirectTarget = isVideo
      ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
      : `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
  } else if (decodedUrl) {
    redirectTarget = decodedUrl;
  } else {
    return res.status(404).send("File tidak ditemukan");
  }

  // Set caching headers agar Cloudflare Edge Cache menyimpan redirect 302 ini
  res.setHeader(
    "Cache-Control",
    "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  );
  res.setHeader("Access-Control-Allow-Origin", "*");

  // HTTP 302 Redirect langsung ke server Google Drive CDN
  return res.redirect(302, redirectTarget);
}
