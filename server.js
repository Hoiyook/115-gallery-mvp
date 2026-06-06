const fs = require("fs");
const http = require("http");
const path = require("path");
const vm = require("vm");

const PORT = 8787;
const ROOT = __dirname;
const AUTH_API = "https://passportapi.115.com/open/refreshToken";
const FILES_API = "https://proapi.115.com/open/ufile/files";

let tokenCache = {
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    addCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/files") {
      await handleFiles(url, res);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, {
      error: "SERVER_ERROR",
      message: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`云廊已启动：http://localhost:${PORT}`);
});

async function handleFiles(url, res) {
  const config = loadConfig();
  if (!config.refreshToken) {
    sendJson(res, 400, {
      error: "MISSING_REFRESH_TOKEN",
      message: "请先在 115-config.js 里填写 refreshToken。",
    });
    return;
  }

  const accessToken = await getAccessToken(config.refreshToken);
  const parentId = url.searchParams.get("parentId") || config.rootFolderId || "0";
  const limit = url.searchParams.get("limit") || String(config.pageSize || 200);
  const offset = url.searchParams.get("offset") || "0";
  const filesUrl = new URL(FILES_API);

  filesUrl.searchParams.set("cid", parentId === "root" ? "0" : parentId);
  filesUrl.searchParams.set("limit", limit);
  filesUrl.searchParams.set("offset", offset);
  filesUrl.searchParams.set("asc", "0");
  filesUrl.searchParams.set("o", "user_utime");
  filesUrl.searchParams.set("cur", "1");
  filesUrl.searchParams.set("show_dir", "1");

  const response = await fetch(filesUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "YunlangGallery/0.1",
    },
  });

  const payload = await response.json();
  if (!response.ok || payload.state === false) {
    sendJson(res, response.ok ? 502 : response.status, {
      error: "115_FILES_FAILED",
      message: payload.message || "读取 115 文件列表失败。",
      raw: payload,
    });
    return;
  }

  const rawFiles = Array.isArray(payload.data) ? payload.data : [];
  sendJson(res, 200, {
    files: rawFiles.map((file) => normalize115File(file, payload.path)),
    count: payload.count,
    cid: payload.cid,
  });
}

async function getAccessToken(refreshToken) {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.refreshToken === refreshToken && tokenCache.expiresAt > now + 60000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams();
  body.set("refresh_token", refreshToken);

  const response = await fetch(AUTH_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "YunlangGallery/0.1",
    },
    body,
  });

  const payload = await response.json();
  const data = payload.data || payload;

  if (!response.ok || payload.code !== 0 || !data.access_token) {
    throw new Error(payload.message || payload.error || "refreshToken 换取 accessToken 失败。");
  }

  tokenCache = {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: Date.now() + Number(data.expires_in || 7200) * 1000,
  };

  return tokenCache.accessToken;
}

function normalize115File(file, pathTree = []) {
  const name = file.fn || file.name || "未命名文件";
  const id = file.fid || file.file_id || file.id;
  const ext = (file.ico || path.extname(name).slice(1) || "").toLowerCase();
  const folder = Array.isArray(pathTree) && pathTree.length
    ? pathTree.map((entry) => entry.name).filter(Boolean).join("/")
    : "115 网盘";

  return {
    id: String(id),
    name,
    path: `${folder}/${name}`,
    folder,
    ext,
    type: getFileType(ext, file),
    size: Number(file.fs || file.size || 0),
    updatedAt: toIso(file.upt || file.uet || file.uppt),
    thumbnailUrl: file.thumb || file.v_img || file.fco || file.uo || "",
    raw: {
      cid: file.pid,
      pickCode: file.pc,
      isDir: file.fc === "0",
    },
  };
}

function getFileType(ext, file) {
  if (file.fc === "0") return "folder";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"].includes(ext)) return "image";
  if (file.isv || ["mp4", "mov", "webm", "m4v", "avi", "mkv"].includes(ext)) return "video";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"].includes(ext)) return "document";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  return "other";
}

function toIso(timestamp) {
  const value = Number(timestamp);
  if (!value) return "";
  return new Date(value * 1000).toISOString();
}

function loadConfig() {
  const configPath = path.join(ROOT, "115-config.js");
  const code = fs.readFileSync(configPath, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.YUNLANG_115_CONFIG || {};
}

async function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, safePath));

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not Found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
