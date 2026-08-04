/* Workboard 记账本 · 分类配置与示例数据
 * 手动记账数据保存在本机浏览器（localStorage，key: wb_ledger_v1）。
 * 本文件只提供默认分类和首次打开时的示例流水，便于直接看到效果。 */
window.WB = window.WB || {};

window.WB.ledger = {
  // 默认分类
  cats: {
    in: ["工资", "奖金", "兼职", "报销", "理财收益", "其他收入"],
    out: ["餐饮", "交通", "住房", "通讯", "购物", "医疗", "学习", "人情", "业务招待", "其他支出"]
  },
  // 首次加载写入的示例流水（2026-08，方便直接看到效果）
  // type: "in" | "out"，amount 为正数，方向由 type 决定
  seed: [
    { date: "2026-08-01", type: "in",  cat: "工资",   amount: 12000, note: "八月薪资" },
    { date: "2026-08-02", type: "out", cat: "餐饮",   amount: 42,    note: "工作午餐" },
    { date: "2026-08-03", type: "out", cat: "交通",   amount: 15,    note: "地铁通勤" },
    { date: "2026-08-03", type: "out", cat: "业务招待", amount: 320,  note: "客户晚餐" },
    { date: "2026-08-04", type: "out", cat: "学习",   amount: 199,   note: "口才训练课程" },
    { date: "2026-08-04", type: "out", cat: "通讯",   amount: 89,    note: "手机话费" }
  ]
};
