/* Workboard 全局配置与运行元信息 */
window.WB = window.WB || {};

window.WB.meta = {
  boardName: "Workboard 个人成长工作台",
  owner: "老板",
  agent: "阿墨",
  lastUpdate: "2026-08-05 06:55",
  buildDate: "2026-08-04",
  // 消防招聘抓取范围：全国全量，按省份分组
  fireScope: "全国全量（按省份分组）",
  theme: "黑白模板（白底正常 / 黑底护眼可切换）",
  modules: [
    { key: "overview", name: "今日总览 · 打卡复盘", icon: "◎" },
    { key: "fire", name: "消防招聘信息", icon: "▲" },
    { key: "news", name: "每日热点资讯", icon: "■" },
    { key: "finance", name: "财经 · 资金流向", icon: "¥" },
    { key: "ledger", name: "记账本 · 个人收支", icon: "⊞" },
    { key: "speech", name: "口才 · 思维阅读", icon: "◆" }
  ]
};
