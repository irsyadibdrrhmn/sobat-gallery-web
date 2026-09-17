export default async function handler(req, res) {
  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).send("URL parameter is required");
  }

  try {
    const response = await fetch(decodeURIComponent(url));
    if (!response.ok) throw new Error("Gagal mengambil file");

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename || "photo.jpg"}"`,
    );
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    return res.status(500).send(err.message);
  }
}
