const state = {
  provider: createProvider(),
  items: [],
  folders: [],
  currentPath: [], // for breadcrumbs and backtracking
  currentCid: null,
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
  folder: "文件夹",
};

// ... rest of constants same

const nodes = {
  // ... same
  breadcrumbs: null, // we'll add in HTML
};

// I need to add breadcrumbs to HTML too, but first plan code.

init();

async function init() {
  try {
    state.items = await state.provider.listFiles(state.currentCid);
  } catch (error) {
    console.error(error);
    state.items = [ /* mock */ ];
  }
  state.folders = collectFolders(state.items);
  bindEvents();
  render();
}

// Update create115Provider to accept parent

function create115Provider(config) {
  return {
    async listFiles(parentId = null) {
      if (!config.apiBaseUrl) {
        throw new Error("...");
      }

      const url = new URL("/files", config.apiBaseUrl);
      url.searchParams.set("parentId", parentId || config.rootFolderId || "root");
      url.searchParams.set("limit", String(config.pageSize || 200));

      // ... fetch same
      // ...
      return files.map(normalize115File);
    },
  };
}

// Similarly for mock if needed, but mock is flat.

// Add function to navigate to folder
async function navigateToFolder(item) {
  if (item.type !== "folder") return;
  state.currentPath.push({id: item.id, name: item.name});
  state.currentCid = item.id;
  state.items = await state.provider.listFiles(state.currentCid);
  state.selectedFolder = item.name;
  state.selectedId = null;
  render();
}

// Back function
async function goBack() {
  if (state.currentPath.length === 0) return;
  state.currentPath.pop();
  state.currentCid = state.currentPath.length > 0 ? state.currentPath[state.currentPath.length - 1].id : null;
  state.items = await state.provider.listFiles(state.currentCid);
  state.selectedFolder = state.currentPath.length > 0 ? state.currentPath[state.currentPath.length - 1].name : "全部目录";
  state.selectedId = null;
  render();
}

// Update render to include breadcrumbs

function renderBreadcrumbs() {
  // implement
}

// In gallery, for folders make them navigable

// Update normalize to detect folders

// etc.
