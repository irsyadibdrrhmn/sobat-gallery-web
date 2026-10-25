export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { session } = req.query;

  if (!session) {
    return res.status(400).json({ error: "Parameter session wajib ada" });
  }

  const apiKey = process.env.GDRIVE_API_KEY;
  if (!apiKey) {
    console.error("GDRIVE_API_KEY is not configured");
    return res.status(503).json({ error: "Layanan galeri belum dikonfigurasi" });
  }

  try {
    const escapedSession = session.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const folderQuery = `mimeType = 'application/vnd.google-apps.folder' and name = '${escapedSession}' and trashed = false`;
    const folderUrl = new URL("https://www.googleapis.com/drive/v3/files");
    folderUrl.searchParams.set("q", folderQuery);
    folderUrl.searchParams.set("supportsAllDrives", "true");
    folderUrl.searchParams.set("includeItemsFromAllDrives", "true");
    folderUrl.searchParams.set("fields", "files(id,name)");
    folderUrl.searchParams.set("key", apiKey);

    const folderRes = await fetch(folderUrl);
    if (!folderRes.ok) {
      console.error("Google Drive folder search failed:", folderRes.status);
      return res.status(502).json({ error: "Gagal mencari sesi di Google Drive" });
    }
    const folderData = await folderRes.json();

    if (!folderData.files || folderData.files.length === 0) {
      return res.status(404).json({ error: "Folder tidak ditemukan" });
    }

    const folderId = folderData.files[0].id;

    const filesQuery = `'${folderId}' in parents and name = 'manifest.json' and trashed = false`;
    const filesUrl = new URL("https://www.googleapis.com/drive/v3/files");
    filesUrl.searchParams.set("q", filesQuery);
    filesUrl.searchParams.set("supportsAllDrives", "true");
    filesUrl.searchParams.set("includeItemsFromAllDrives", "true");
    filesUrl.searchParams.set("fields", "files(id,name)");
    filesUrl.searchParams.set("key", apiKey);

    const filesRes = await fetch(filesUrl);
    if (!filesRes.ok) {
      console.error("Google Drive manifest search failed:", filesRes.status);
      return res.status(502).json({ error: "Gagal mencari manifest sesi" });
    }
    const filesData = await filesRes.json();

    if (!filesData.files || filesData.files.length === 0) {
      return res.status(404).json({ error: "manifest.json tidak ditemukan" });
    }

    const manifestId = filesData.files[0].id;
    const manifestUrl = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(manifestId)}`,
    );
    manifestUrl.searchParams.set("alt", "media");
    manifestUrl.searchParams.set("key", apiKey);

    const contentRes = await fetch(manifestUrl);
    if (!contentRes.ok) {
      console.error("Google Drive manifest content request failed:", contentRes.status);
      return res.status(502).json({ error: "Manifest sesi tidak dapat diakses" });
    }
    const manifest = await contentRes.json();

    // Cache di Edge Cloudflare selama 1 jam agar pencarian berulang pada sesi yang sama tidak memakan kuota
    res.setHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
    );

    return res.status(200).json(manifest);
  } catch (err) {
    console.error("Google Drive session search error:", err);
    return res.status(502).json({ error: "Gagal menghubungi Google Drive" });
  }
}

