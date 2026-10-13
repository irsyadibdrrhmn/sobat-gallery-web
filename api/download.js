const GDRIVE_API_KEY = "AIzaSyBiplyOJDEZxGNoUdbFBB5CU7fFY_M2r1g";

export default async function handler(req, res) {
  const { url, id, filename } = req.query;

  if (!url && !id) {
    return res.status(400).send("URL or ID parameter is required");
  }

  let fileId = id || "";
  const decodedUrl = url ? decodeURIComponent(url) : "";
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
  const fallbackContentType = lowerName.endsWith(".mp4")
    ? "video/mp4"
    : lowerName.endsWith(".gif")
      ? "image/gif"
      : lowerName.endsWith(".png")
        ? "image/png"
        : "image/jpeg";

  try {
    let response = null;

    // 1. Prioritaskan unduhan resolusi penuh langsung via Google Drive API v3 (alt=media)
    if (fileId) {
      try {
        const apiRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GDRIVE_API_KEY}`,
        );
        if (apiRes.ok) {
          response = apiRes;
        }
      } catch (e) {}
    }

    // 2. Fallback ke URL asli jika bukan fileId atau API gagal
    if (!response && decodedUrl) {
      const directRes = await fetch(decodedUrl);
      if (directRes.ok) {
        response = directRes;
      }
    }

    if (!response || !response.ok) {
      throw new Error("Gagal mengambil file");
    }

    let contentType = response.headers.get("content-type") || "";
    if (!contentType || contentType === "application/octet-stream" || contentType.includes("text/html")) {
      contentType = fallbackContentType;
    }

    const arrayBuffer = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"`,
    );
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    return res.status(500).send(err.message);
  }
}
