export default async function handler(req, res) {
  // Aktifkan CORS untuk domain web Anda
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Parameter id wajib disertakan" });
  }

  const apiKey = "AIzaSyBiplyOJDEZxGNoUdbFBB5CU7fFY_M2r1g";

  try {
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${apiKey}`,
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      return res.status(driveRes.status).send(errText);
    }

    const data = await driveRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
