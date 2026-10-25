export async function onRequestGet(context) {
  const { request } = context;
  const urlObj = new URL(request.url);

  const urlParam = urlObj.searchParams.get("url");
  const idParam = urlObj.searchParams.get("id");
  const filename = urlObj.searchParams.get("filename") || "photo.jpg";

  if (!urlParam && !idParam) {
    return new Response("URL or ID parameter is required", { status: 400 });
  }

  let fileId = idParam || "";
  let decodedUrl = "";
  if (urlParam) {
    try {
      decodedUrl = decodeURIComponent(urlParam);
    } catch (e) {
      decodedUrl = urlParam;
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

  const safeFilename = filename.replace(/["\r\n]/g, "_");
  const lowerName = safeFilename.toLowerCase();
  const isVideo = lowerName.endsWith(".mp4");

  let redirectTarget = "";
  if (fileId) {
    redirectTarget = isVideo
      ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
      : `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`;
  } else if (decodedUrl) {
    redirectTarget = decodedUrl;
  } else {
    return new Response("File tidak ditemukan", { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectTarget,
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

