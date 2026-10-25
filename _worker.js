export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Intercept /api/download
    if (pathname === "/api/download" || pathname === "/api/download.js") {
      const urlParam = url.searchParams.get("url");
      const idParam = url.searchParams.get("id");
      const filename = url.searchParams.get("filename") || "photo.jpg";
      const typeParam = (url.searchParams.get("type") || "").toLowerCase();

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
      const lowerUrl = decodedUrl.toLowerCase();

      const isVideo =
        typeParam === "video" ||
        typeParam === "mp4" ||
        lowerName.endsWith(".mp4") ||
        lowerUrl.includes(".mp4") ||
        lowerUrl.includes("ext=.mp4");

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

    // 2. Intercept /api/manifest
    if (pathname === "/api/manifest" || pathname === "/api/manifest.js") {
      const id = url.searchParams.get("id");
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
        return new Response(JSON.stringify({ error: "Gagal menghubungi Google Drive" }), {
          status: 502,
          headers,
        });
      }
    }

    // 3. Intercept /api/search
    if (pathname === "/api/search" || pathname === "/api/search.js") {
      const session = url.searchParams.get("session");
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
        return new Response(JSON.stringify({ error: "Gagal menghubungi Google Drive" }), {
          status: 502,
          headers,
        });
      }
    }

    // Default: serahkan ke asset statis (index.html, dll.)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};

