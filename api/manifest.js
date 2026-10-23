export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Parameter id wajib disertakan" });
  }

  const apiKey = process.env.GDRIVE_API_KEY;
  if (!apiKey) {
    console.error("GDRIVE_API_KEY is not configured");
    return res.status(503).json({ error: "Layanan galeri belum dikonfigurasi" });
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
      return res.status(driveRes.status).json({ error: "Manifest tidak dapat diakses" });
    }

    const data = await driveRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Google Drive manifest request error:", err);
    return res.status(502).json({ error: "Gagal menghubungi Google Drive" });
  }
}
