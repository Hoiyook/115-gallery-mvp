const state = {
  provider: createProvider(),
  items: [],
  folders: [],
  selectedFolder: "全部目录",
  filter: "all",
  query: "",
  selectedId: null,
  objectUrls: new Map(),
};

const typeLabels = {
  image: "图片",
  video: "视频",
  document: "文档",
  archive: "压缩包",
  other: "其他",
};

const imageExtensions = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"];
const videoExtensions = ["mp4", "mov", "webm", "m4v", "avi", "mkv"];
const documentExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"];
const archiveExtensions = ["zip", "rar", "7z", "tar", "gz"];

const nodes = {
  folderTree: document.querySelector("#folderTree"),
  gallery: document.querySelector("#gallery"),
  searchInput: document.querySelector("#searchInput"),
  viewTitle: document.querySelector("#viewTitle"),
  totalCount: document.querySelector("#totalCount"),
  imageCount: document.querySelector("#imageCount"),
  videoCount: document.querySelector("#videoCount"),
  selectedFolder: document.querySelector("#selectedFolder"),
  folderInput: document.querySelector("#folderInput"),
  connect115Button: document.querySelector("#connect115Button"),
  connectDialog: document.querySelector("#connectDialog"),
  emptyDetail: document.querySelector("#emptyDetail"),
  detailPanel: document.querySelector("#detailPanel"),
  detailPreview: document.querySelector("#detailPreview"),
  detailName: document.querySelector("#detailName"),
  detailType: document.querySelector("#detailType"),
  detailPath: document.querySelector("#detailPath"),
  detailSize: document.querySelector("#detailSize"),
  detailDate: document.querySelector("#detailDate"),
  favoriteButton: document.querySelector("#favoriteButton"),
  laterButton: document.querySelector("#laterButton"),
  detailTags: document.querySelector("#detailTags"),
};

init();

async function init() {
  try {
    state.items = await state.provider.listFiles();
  } catch (error) {
    console.error(error);
    state.items = [
      makeMockItem(
        "config-error",
        "115 配置还没有连通.md",
        "系统提示",
        "document",
        "md",
        0,
        Date.now(),
        ["配置", "115"],
        false,
        true,
        "",
      ),
    ];
  }
  state.folders = collectFolders(state.items);
  bindEvents();
  render();
}

function bindEvents() {
  nodes.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderGallery();
  });

  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".filter").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      renderGallery();
    });
  });

  nodes.folderInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    state.items = files.map(fileToGalleryItem);
    state.folders = collectFolders(state.items);
    state.selectedFolder = "全部目录";
    state.selectedId = null;
    render();
  });

  nodes.connect115Button.addEventListener("click", () => {
    nodes.connectDialog.showModal();
  });

  nodes.favoriteButton.addEventListener("click", () => toggleFlag("favorite"));
  nodes.laterButton.addEventListener("click", () => toggleFlag("later"));
}

function render() {
  renderFolders();
  renderGallery();
  renderDetail();
}

function renderFolders() {
  const folders = ["全部目录", ...state.folders];
  nodes.folderTree.innerHTML = "";

  folders.forEach((folder) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = folder === state.selectedFolder ? "is-active" : "";
    button.innerHTML = `<span>${escapeHtml(folder)}</span><small>${countByFolder(folder)}</small>`;
    button.addEventListener("click", () => {
      state.selectedFolder = folder;
      state.selectedId = null;
      render();
    });
    nodes.folderTree.append(button);
  });
}

function renderGallery() {
  const items = getFilteredItems();
  nodes.gallery.innerHTML = "";
  nodes.viewTitle.textContent = state.selectedFolder === "全部目录" ? "全部文件" : state.selectedFolder;
  nodes.totalCount.textContent = items.length;
  nodes.imageCount.textContent = items.filter((item) => item.type === "image").length;
  nodes.videoCount.textContent = items.filter((item) => item.type === "video").length;
  nodes.selectedFolder.textContent = state.selectedFolder;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `<div class="card-body"><p class="name">没有匹配结果</p><p class="meta">换个筛选或关键词试试</p></div>`;
    nodes.gallery.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `card ${item.id === state.selectedId ? "is-selected" : ""}`;
    card.tabIndex = 0;
    card.innerHTML = `
      ${renderCover(item)}
      <div class="card-body">
        <p class="name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>
        <div class="meta">
          <span>${typeLabels[item.type] || "其他"}</span>
          <span>${formatSize(item.size)}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => selectItem(item.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") selectItem(item.id);
    });
    nodes.gallery.append(card);
  });
}

function renderCover(item) {
  const badges = `
    <div class="badge-row">
      ${item.favorite ? `<span class="badge" title="收藏">★</span>` : ""}
      ${item.later ? `<span class="badge" title="稍后整理">↗</span>` : ""}
    </div>
  `;

  if (item.type === "image" && item.url) {
    return `<div class="cover"><img src="${item.url}" alt="${escapeHtml(item.name)}" loading="lazy" />${badges}</div>`;
  }

  if (item.type === "video" && item.url) {
    return `<div class="cover"><video src="${item.url}" muted preload="metadata"></video>${badges}</div>`;
  }

  if (item.sampleCover) {
    return `<div class="cover ${item.sampleCover}"><span class="file-icon">${escapeHtml(item.ext.toUpperCase())}</span>${badges}</div>`;
  }

  return `<div class="cover"><span class="file-icon">${escapeHtml(item.ext.toUpperCase() || item.type.toUpperCase())}</span>${badges}</div>`;
}

function renderDetail() {
  const item = state.items.find((entry) => entry.id === state.selectedId);
  nodes.emptyDetail.classList.toggle("is-hidden", Boolean(item));
  nodes.detailPanel.classList.toggle("is-hidden", !item);

  if (!item) return;

  nodes.detailPreview.innerHTML = renderPreview(item);
  nodes.detailName.textContent = item.name;
  nodes.detailType.textContent = typeLabels[item.type] || "其他";
  nodes.detailPath.textContent = item.path;
  nodes.detailSize.textContent = formatSize(item.size);
  nodes.detailDate.textContent = item.modifiedAt;
  nodes.favoriteButton.classList.toggle("is-on", item.favorite);
  nodes.favoriteButton.textContent = item.favorite ? "已收藏" : "收藏";
  nodes.laterButton.classList.toggle("is-on", item.later);
  nodes.laterButton.textContent = item.later ? "已加入" : "稍后整理";
  nodes.detailTags.innerHTML = item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
}

function renderPreview(item) {
  if (item.type === "image" && item.url) {
    return `<img src="${item.url}" alt="${escapeHtml(item.name)}" />`;
  }
  if (item.type === "video" && item.url) {
    return `<video src="${item.url}" controls></video>`;
  }
  return `<div class="cover ${item.sampleCover || ""}"><span class="file-icon">${escapeHtml(item.ext.toUpperCase() || "FILE")}</span></div>`;
}

function selectItem(id) {
  state.selectedId = id;
  renderGallery();
  renderDetail();
}

function toggleFlag(flag) {
  const item = state.items.find((entry) => entry.id === state.selectedId);
  if (!item) return;
  item[flag] = !item[flag];
  renderGallery();
  renderDetail();
}

function getFilteredItems() {
  return state.items.filter((item) => {
    const matchesFolder = state.selectedFolder === "全部目录" || item.folder === state.selectedFolder;
    const matchesFilter =
      state.filter === "all" ||
      item.type === state.filter ||
      (state.filter === "favorite" && item.favorite) ||
      (state.filter === "later" && item.later);
    const haystack = [item.name, item.path, item.folder, ...item.tags].join(" ").toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesFolder && matchesFilter && matchesQuery;
  });
}

function collectFolders(items) {
  return [...new Set(items.map((item) => item.folder))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function countByFolder(folder) {
  if (folder === "全部目录") return state.items.length;
  return state.items.filter((item) => item.folder === folder).length;
}

function fileToGalleryItem(file, index) {
  const relativePath = file.webkitRelativePath || file.name;
  const pathParts = relativePath.split("/");
  const folder = pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : "未分组";
  const ext = getExtension(file.name);
  const type = getFileType(ext);
  const url = type === "image" || type === "video" ? URL.createObjectURL(file) : "";
  if (url) state.objectUrls.set(relativePath, url);

  return {
    id: `local-${index}-${relativePath}`,
    name: file.name,
    path: relativePath,
    folder,
    ext,
    type,
    size: file.size,
    modifiedAt: new Date(file.lastModified).toLocaleString("zh-CN"),
    tags: [typeLabels[type] || "其他", folder.split("/").at(-1)],
    favorite: false,
    later: false,
    url,
  };
}

function getExtension(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function getFileType(ext) {
  if (imageExtensions.includes(ext)) return "image";
  if (videoExtensions.includes(ext)) return "video";
  if (documentExtensions.includes(ext)) return "document";
  if (archiveExtensions.includes(ext)) return "archive";
  return "other";
}

function formatSize(size) {
  if (!size) return "未知";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createMockProvider() {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  return {
    async listFiles() {
      return [
        makeMockItem("photo-1", "海边散步-001.jpg", "照片/旅行/厦门", "image", "jpg", 4380000, now - day * 2, ["旅行", "海边"], true, false, "sample-a"),
        makeMockItem("photo-2", "展览灵感墙.png", "照片/灵感/设计", "image", "png", 2160000, now - day * 5, ["设计", "灵感"], false, true, "sample-b"),
        makeMockItem("video-1", "家庭聚会片段.mp4", "视频/家庭", "video", "mp4", 184000000, now - day * 8, ["家庭", "视频"], false, false, "sample-c"),
        makeMockItem("doc-1", "AI产品想法.md", "资料/想法", "document", "md", 42000, now - day * 1, ["想法", "AI"], true, false, ""),
        makeMockItem("zip-1", "旧硬盘照片备份.zip", "归档/待整理", "archive", "zip", 2600000000, now - day * 30, ["备份", "待整理"], false, true, ""),
        makeMockItem("photo-3", "菜谱截图合集.webp", "照片/生活/饮食", "image", "webp", 920000, now - day * 3, ["生活", "饮食"], false, false, "sample-c"),
      ];
    },
  };
}

function createProvider() {
  const config = window.YUNLANG_115_CONFIG || {};
  if (config.mode === "115") return create115Provider(config);
  return createMockProvider();
}

function create115Provider() {
  const config = window.YUNLANG_115_CONFIG || {};
  return {
    async listFiles() {
      if (!config.apiBaseUrl) {
        throw new Error("请先在 115-config.js 中填写 apiBaseUrl，并启动本地 115 转接服务。");
      }

      const url = new URL("/files", config.apiBaseUrl);
      url.searchParams.set("parentId", config.rootFolderId || "root");
      url.searchParams.set("limit", String(config.pageSize || 200));

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`115 文件列表读取失败：${response.status}`);
      }

      const payload = await response.json();
      const files = Array.isArray(payload) ? payload : payload.files || payload.data || [];
      return files.map(normalize115File);
    },
  };
}

function normalize115File(file, index) {
  const name = file.name || file.file_name || file.filename || `未命名文件-${index + 1}`;
  const path = file.path || file.fullPath || file.full_path || name;
  const folder = file.folder || file.parentPath || file.parent_path || path.split("/").slice(0, -1).join("/") || "未分组";
  const ext = getExtension(name);
  const type = file.type === "folder" ? "other" : file.type || getFileType(ext);

  return {
    id: String(file.id || file.file_id || file.cid || `115-${index}`),
    name,
    path,
    folder,
    ext,
    type,
    size: Number(file.size || file.file_size || 0),
    modifiedAt: format115Date(file.modifiedAt || file.updatedAt || file.update_time || file.utime),
    tags: [typeLabels[type] || "其他", folder.split("/").at(-1)].filter(Boolean),
    favorite: false,
    later: false,
    sampleCover: "",
    url: file.thumbnailUrl || file.thumb || file.cover || file.previewUrl || "",
  };
}

function format115Date(value) {
  if (!value) return "未知";
  if (typeof value === "number" && value < 10000000000) {
    return new Date(value * 1000).toLocaleString("zh-CN");
  }
  return new Date(value).toLocaleString("zh-CN");
}

function makeMockItem(id, name, folder, type, ext, size, timestamp, tags, favorite, later, sampleCover) {
  return {
    id,
    name,
    path: `${folder}/${name}`,
    folder,
    type,
    ext,
    size,
    modifiedAt: new Date(timestamp).toLocaleString("zh-CN"),
    tags,
    favorite,
    later,
    sampleCover,
    url: "",
  };
}
