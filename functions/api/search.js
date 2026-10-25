export async function onRequestGet(context) {
  const { request, env } = context;
  const urlObj = new URL(request.url);
  const session = urlObj.searchParams.get("session");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (!session) {
    return new Response(JSON.stringify({ error: "Parameter session wajib ada" }), {
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
      return new Response(JSON.stringify({ error: "Gagal mencari sesi di Google Drive" }), {
        status: 502,
        headers,
      });
    }
    const folderData = await folderRes.json();

    if (!folderData.files || folderData.files.length === 0) {
      return new Response(JSON.stringify({ error: "Folder tidak ditemukan" }), {
        status: 404,
        headers,
      });
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
      return new Response(JSON.stringify({ error: "Gagal mencari manifest sesi" }), {
        status: 502,
        headers,
      });
    }
    const filesData = await filesRes.json();

    if (!filesData.files || filesData.files.length === 0) {
      return new Response(JSON.stringify({ error: "manifest.json tidak ditemukan" }), {
        status: 404,
        headers,
      });
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
      return new Response(JSON.stringify({ error: "Manifest sesi tidak dapat diakses" }), {
        status: 502,
        headers,
      });
    }
    const manifest = await contentRes.text();

    return new Response(manifest, {
      status: 200,
      headers: {
        ...headers,
        "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("Google Drive session search error:", err);
    return new Response(JSON.stringify({ error: "Gagal menghubungi Google Drive" }), {
      status: 502,
      headers,
    });
  }
}

