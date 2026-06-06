window.YUNLANG_115_CONFIG = {
  // 改成 "115" 后，应用会读取下面的 115 对接信息；保持 "mock" 就继续使用示例数据。
  mode: "115",

  // 你的 115 API 转接服务地址。建议用你自己的本地/私有后端转接 115 Open API。
  // 例子："http://localhost:8787"
  apiBaseUrl: "http://localhost:8787",

  // 115 授权后得到的 refresh token。正式桌面版建议改成系统钥匙串或本地加密存储。
  refreshToken: "",

  // 想作为画廊首页的 115 文件夹 ID。留空表示使用网盘根目录。
  rootFolderId: "",

  // 一次拉取多少个文件。
  pageSize: 200,
};
