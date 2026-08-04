/* Workboard 个人成长工作台 · 交互脚本 */
(function () {
  "use strict";

  var WB = window.WB || {};
  var META = WB.meta || {};

  /* ---------------- helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  // 允许 **加粗** 的极简标记
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function shiftDay(str, n) {
    var p = str.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function daysBetween(a, b) {
    var pa = a.split("-"), pb = b.split("-");
    var da = new Date(+pa[0], +pa[1] - 1, +pa[2]);
    var db = new Date(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }
  var WEEK = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  function cnDate(str) {
    var p = str.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return p[0] + " 年 " + (+p[1]) + " 月 " + (+p[2]) + " 日 · " + WEEK[d.getDay()];
  }
  function shortDate(str) { var p = str.split("-"); return (+p[1]) + "/" + (+p[2]); }

  var TODAY = iso(new Date());

  /* 从按日期倒序的数组里取某天，取不到则取最新的一天 */
  function pickEntry(list, date) {
    if (!list || !list.length) return null;
    for (var i = 0; i < list.length; i++) if (list[i].date === date) return list[i];
    return list[0];
  }

  /* 日期选择条 */
  function datePills(list, current, onPick) {
    var box = document.createElement("div");
    box.className = "datepills";
    list.forEach(function (e) {
      var b = document.createElement("button");
      b.className = "pill" + (e.date === current ? " on" : "") + (e.date === TODAY ? " today-pill" : "");
      b.textContent = e.date === TODAY ? "今日" : shortDate(e.date);
      b.onclick = function () { onPick(e.date); };
      box.appendChild(b);
    });
    return box;
  }

  /* ============ 0. 总览 · 打卡复盘 ============ */
  var CHECK_KEY = "wb_checkin_v1";
  var CHECK_ITEMS = [
    { k: "english", label: "每日英语" },
    { k: "fire", label: "消防招聘" },
    { k: "news", label: "热点资讯" },
    { k: "finance", label: "财经资讯" },
    { k: "speech", label: "口才训练" }
  ];

  function loadCheck() {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveCheck(o) {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function dayHit(rec) {
    if (!rec || !rec.items) return false;
    for (var k in rec.items) if (rec.items[k]) return true;
    return false;
  }
  function calcStreak(store) {
    var n = 0, d = TODAY;
    if (!dayHit(store[d])) d = shiftDay(d, -1);   // 今天还没打卡不断链
    while (dayHit(store[d])) { n++; d = shiftDay(d, -1); }
    return n;
  }

  function renderOverview() {
    var store = loadCheck();
    var rec = store[TODAY] || { items: {}, note: "" };

    var greet = META.owner ? ("早上好，" + META.owner) : "今日工作台";
    var h = new Date().getHours();
    if (META.owner) {
      var prefix = h < 11 ? "早上好" : (h < 14 ? "中午好" : (h < 18 ? "下午好" : "晚上好"));
      greet = prefix + "，" + META.owner;
    }
    $("#heroHello").textContent = greet;
    $("#heroDate").textContent = cnDate(TODAY) + " · 数据更新于 " + (META.lastUpdate || "—");

    // 在招岗位数
    var live = liveJobs().length;
    $("#statLive").textContent = live;

    // 打卡格
    var row = $("#checkRow");
    row.innerHTML = "";
    CHECK_ITEMS.forEach(function (it) {
      var d = document.createElement("div");
      d.className = "chk" + (rec.items[it.k] ? " done" : "");
      d.innerHTML = '<span class="chk-box">✓</span><span>' + it.label + "</span>";
      d.onclick = function () {
        rec.items[it.k] = !rec.items[it.k];
        store[TODAY] = rec; saveCheck(store);
        renderOverview();
      };
      row.appendChild(d);
    });

    // 完成度
    var done = CHECK_ITEMS.filter(function (i) { return rec.items[i.k]; }).length;
    $("#statDone").textContent = done + "/5";
    $("#statStreak").textContent = calcStreak(store);

    // 复盘
    var ta = $("#reviewNote");
    if (document.activeElement !== ta) ta.value = rec.note || "";
    ta.oninput = function () {
      rec.note = ta.value; store[TODAY] = rec; saveCheck(store);
      var s = $("#savedFlag"); s.classList.add("show");
      clearTimeout(ta._t); ta._t = setTimeout(function () { s.classList.remove("show"); }, 1200);
    };

    // 近 7 天条
    var strip = $("#streakStrip");
    strip.innerHTML = '<span class="strip-lbl">近 7 天</span>';
    for (var i = 6; i >= 0; i--) {
      var dt = shiftDay(TODAY, -i);
      var sp = document.createElement("span");
      sp.className = "sday" + (dayHit(store[dt]) ? " hit" : "") + (dt === TODAY ? " today" : "");
      sp.textContent = (+dt.split("-")[2]);
      sp.title = dt;
      strip.appendChild(sp);
    }
  }

  /* ============ 1. 每日英语 ============ */
  function renderEnglish(date) {
    var list = WB.english || [];
    var e = pickEntry(list, date || TODAY);
    var box = $("#englishBody");
    if (!e) { box.innerHTML = '<div class="empty">暂无素材</div>'; return; }

    box.innerHTML =
      '<div class="grid2">' +
        '<div class="card card-pad">' +
          '<h3 class="en-scene">' + esc(e.scene) + "</h3>" +
          '<div class="en-goal">' + esc(e.goal) + "</div>" +
          '<div class="sub-h">情景对话</div>' +
          '<div class="dlg">' +
            e.dialogue.map(function (l) {
              return '<div class="dlg-line' + (/you/i.test(l.role) ? " you" : "") + '">' +
                '<div class="dlg-role">' + esc(l.role) + "</div>" +
                '<div class="dlg-body"><div class="dlg-en">' + esc(l.en) + "</div>" +
                '<div class="dlg-zh">' + esc(l.zh) + "</div></div></div>";
            }).join("") +
          "</div>" +
        "</div>" +
        "<div>" +
          '<div class="card card-pad" style="margin-bottom:14px">' +
            '<div class="sub-h">高频短句 · 背下来直接能用</div>' +
            '<ul class="phr">' + e.phrases.map(function (p) {
              return "<li><div class=\"p-en\">" + esc(p.en) + "</div><div class=\"p-zh\">" + esc(p.zh) + "</div></li>";
            }).join("") + "</ul>" +
          "</div>" +
          '<div class="card card-pad">' +
            '<div class="sub-h">今日词块</div>' +
            '<div class="focus-row">' + e.focus.map(function (f) {
              return '<span class="focus-chip"><b>' + esc(f.w) + "</b> · " + esc(f.zh) + "</span>";
            }).join("") + "</div>" +
          "</div>" +
        "</div>" +
      "</div>";

    var nav = $("#englishDates");
    nav.innerHTML = "";
    nav.appendChild(datePills(list, e.date, renderEnglish));
  }

  /* ============ 2. 消防招聘 ============ */
  function allJobs() { return (WB.fireJobs && WB.fireJobs.jobs) || []; }
  function isLive(j) { return j.regEnd >= TODAY; }
  function liveJobs() { return allJobs().filter(isLive); }

  function jobCard(j) {
    var live = isLive(j);
    var left = live ? daysBetween(TODAY, j.regEnd) : 0;
    var cntTxt = j.count != null ? (j.count + " 人") : (j.countText || "详见公告");

    var badge = live
      ? '<span class="tag t-red">报名中</span>'
      : (j.status ? '<span class="tag t-amber">' + esc(j.status) + "</span>"
                  : '<span class="tag t-gray">已截止</span>');

    var cd = live
      ? '<span class="countdown">' + (left === 0 ? "今天最后一天" : "剩 " + left + " 天") + "</span>"
      : "";

    return '<div class="job ' + (live ? "live" : "expired") + '">' +
      '<div class="job-head"><h4 class="job-title">' + esc(j.district) + "</h4>" + badge + "</div>" +
      '<div class="job-meta">' +
        '<span class="tag t-blue">' + esc(j.province) + (j.city && j.city !== "—" ? " · " + esc(j.city) : "") + "</span>" +
        '<span class="tag t-gray">招 ' + esc(cntTxt) + "</span>" +
      "</div>" +
      '<dl class="job-kv">' +
        "<dt>招录岗位</dt><dd>" + esc(j.post) + "</dd>" +
        "<dt>报名时间</dt><dd>" + esc(j.regStart) + " 至 " + esc(j.regEnd) + " " + cd + "</dd>" +
        "<dt>报名方式</dt><dd>" + esc(j.regPlace) + "</dd>" +
      "</dl>" +
      "<details><summary>报考资质与流程</summary>" +
        '<ul class="req">' + (j.requirements || []).map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>" +
        '<dl class="job-kv" style="margin-top:8px">' +
          "<dt>招录流程</dt><dd>" + esc(j.process) + "</dd>" +
          (j.workMode && j.workMode !== "—" ? "<dt>待遇执勤</dt><dd>" + esc(j.workMode) + "</dd>" : "") +
          (j.contact && j.contact !== "—" ? "<dt>咨询方式</dt><dd>" + esc(j.contact) + "</dd>" : "") +
        "</dl>" +
      "</details>" +
      '<div class="job-foot"><span>来源：' + esc(j.source) + "</span>" +
        (j.url ? '<a href="' + esc(j.url) + '" target="_blank" rel="noopener">查看官方公告 →</a>' : "") +
      "</div>" +
    "</div>";
  }

  function groupByProvince(list) {
    var m = {}, order = [];
    list.forEach(function (j) {
      if (!m[j.province]) { m[j.province] = []; order.push(j.province); }
      m[j.province].push(j);
    });
    return order.map(function (p) { return { province: p, items: m[p] }; });
  }

  function renderFire() {
    var jobs = allJobs();
    var kw = ($("#fireSearch").value || "").trim().toLowerCase();
    var prov = $("#fireProv").value;

    function match(j) {
      if (prov && j.province !== prov) return false;
      if (!kw) return true;
      var hay = [j.province, j.city, j.district, j.post, (j.requirements || []).join(" ")].join(" ").toLowerCase();
      return hay.indexOf(kw) >= 0;
    }

    var live = jobs.filter(function (j) { return isLive(j) && match(j); });
    var past = jobs.filter(function (j) { return !isLive(j) && match(j); });

    // 在招（按省份分组）
    var host = $("#fireLive");
    if (!live.length) {
      host.innerHTML = '<div class="card"><div class="empty">当前筛选条件下没有正在报名的岗位。展开下方历史归档可查看已截止公告。</div></div>';
    } else {
      host.innerHTML = groupByProvince(live).map(function (g) {
        return '<div class="prov-head">' + esc(g.province) + " · " + g.items.length + " 条</div>" +
          '<div class="jobs">' + g.items.map(jobCard).join("") + "</div>";
      }).join("");
    }

    // 历史归档
    $("#fireArchiveCount").textContent = past.length;
    $("#fireArchive").innerHTML = past.length
      ? groupByProvince(past).map(function (g) {
          return '<div class="prov-head" style="margin-top:8px">' + esc(g.province) + "</div>" +
            '<div class="jobs">' + g.items.map(jobCard).join("") + "</div>";
        }).join("")
      : '<div class="empty">无归档记录</div>';

    $("#fireCount").textContent = "在招 " + live.length + " 条 · 归档 " + past.length + " 条";
  }

  function initFire() {
    var provs = [];
    allJobs().forEach(function (j) { if (provs.indexOf(j.province) < 0) provs.push(j.province); });
    var sel = $("#fireProv");
    provs.sort().forEach(function (p) {
      var o = document.createElement("option"); o.value = p; o.textContent = p; sel.appendChild(o);
    });
    sel.onchange = renderFire;
    $("#fireSearch").oninput = renderFire;
    $("#fireNote").textContent = (WB.fireJobs && WB.fireJobs.sourceNote) || "";
    renderFire();
  }

  /* ============ 3. 热点资讯 ============ */
  function renderNews(date) {
    var list = WB.news || [];
    var e = pickEntry(list, date || TODAY);
    var box = $("#newsBody");
    if (!e) { box.innerHTML = '<div class="empty">暂无资讯</div>'; return; }

    box.innerHTML = '<div class="card card-pad"><div class="news-list">' +
      e.items.map(function (n) {
        return '<div class="news-item">' +
          '<span class="tag t-blue">' + esc(n.tag) + "</span>" +
          '<div class="news-title">' + esc(n.title) + "</div>" +
          '<div class="news-digest">' + esc(n.digest) + "</div>" +
          '<div class="news-angle">' + esc(n.angle) + "</div>" +
          '<div class="news-src">来源：' + esc(n.source) +
            (n.url ? ' · <a href="' + esc(n.url) + '" target="_blank" rel="noopener">原文</a>' : "") +
          "</div></div>";
      }).join("") + "</div></div>";

    var nav = $("#newsDates"); nav.innerHTML = "";
    nav.appendChild(datePills(list, e.date, renderNews));
  }

  /* ============ 4. 财经资讯 ============ */
  function renderFinance(date) {
    var list = WB.finance || [];
    var e = pickEntry(list, date || TODAY);
    var box = $("#financeBody");
    if (!e) { box.innerHTML = '<div class="empty">暂无资讯</div>'; return; }

    var lesson = '<div class="lesson"><h4>' + esc(e.lesson.title) + "</h4>" +
      e.lesson.body.map(function (p) { return "<p>" + md(p) + "</p>"; }).join("") +
      '<div style="margin-top:12px"><span class="tag t-amber">关键词 · ' + esc(e.lesson.keyword) + "</span></div></div>";

    var rates = '<div class="card card-pad"><div class="sub-h">' + esc(e.rates.title) + "</div>" +
      '<table class="rate-table"><thead><tr><th>存期</th><th style="text-align:right">挂牌年利率</th></tr></thead><tbody>' +
      e.rates.rows.map(function (r) { return "<tr><td>" + esc(r.term) + "</td><td>" + esc(r.rate) + "</td></tr>"; }).join("") +
      "</tbody></table>" +
      '<div style="font-size:12px;color:var(--faint);margin-top:9px">' + esc(e.rates.note) + "</div></div>";

    var bm = '<div class="card card-pad"><div class="sub-h">关键利率锚点</div><div class="bm-grid">' +
      e.benchmarks.map(function (b) {
        return '<div class="bm"><div class="bm-name">' + esc(b.name) + "</div>" +
          '<div class="bm-val">' + esc(b.value) + "</div>" +
          '<div class="bm-note">' + esc(b.note) + "</div></div>";
      }).join("") + "</div></div>";

    var items = '<div class="card card-pad">' +
      e.items.map(function (n) {
        return '<div class="fin-item"><span class="tag t-green">' + esc(n.tag) + "</span>" +
          '<div class="fin-title">' + esc(n.title) + "</div>" +
          '<div class="fin-digest">' + esc(n.digest) + "</div>" +
          '<div class="fin-take">' + esc(n.takeaway) + "</div></div>";
      }).join("") +
      '<div class="risk-note">' + esc(e.risk) + "</div></div>";

    box.innerHTML = lesson +
      '<div class="grid2" style="margin-top:14px">' + rates + bm + "</div>" +
      '<div style="margin-top:14px">' + items + "</div>";

    var nav = $("#financeDates"); nav.innerHTML = "";
    nav.appendChild(datePills(list, e.date, renderFinance));
  }

  /* ============ 5. 记账本 · 个人收支 ============ */
  var LEDGER_KEY = "wb_ledger_v1";
  var ledgerMonth = TODAY.slice(0, 7);   // 当前查看的月份 YYYY-MM

  function defaultLedger() {
    var cats = (WB.ledger && JSON.parse(JSON.stringify(WB.ledger.cats))) || { in: [], out: [] };
    return { records: [], cats: cats };
  }
  function loadLedger() {
    try {
      var raw = localStorage.getItem(LEDGER_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // 首次打开：用 seed 示例初始化，让老板直接看到效果
    var d = defaultLedger();
    if (WB.ledger && WB.ledger.seed) {
      d.records = WB.ledger.seed.map(function (s, i) {
        return { id: "s" + i + "_" + s.date, date: s.date, type: s.type, cat: s.cat, amount: s.amount, note: s.note || "" };
      });
    }
    saveLedger(d);
    return d;
  }
  function saveLedger(o) {
    try { localStorage.setItem(LEDGER_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function fmtMoney(n) {
    return "¥" + (Math.round(n * 100) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function updateCatOptions() {
    var data = loadLedger();
    var checked = $("#ledgerTypes").querySelector("input:checked");
    var type = (checked && checked.value) || "out";
    var sel = $("#lfCat");
    sel.innerHTML = "";
    data.cats[type].forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o);
    });
  }

  function renderLedger() {
    var data = loadLedger();
    var month = ledgerMonth;

    var recs = data.records
      .filter(function (r) { return r.date.slice(0, 7) === month; })
      .sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });

    var inSum = 0, outSum = 0;
    recs.forEach(function (r) { if (r.type === "in") inSum += r.amount; else outSum += r.amount; });
    var bal = inSum - outSum;

    $("#ledgerSummary").innerHTML =
      '<div class="ls-card ls-in"><div class="ls-lbl">本月收入</div><div class="ls-num">' + fmtMoney(inSum) + "</div></div>" +
      '<div class="ls-card ls-out"><div class="ls-lbl">本月支出</div><div class="ls-num">' + fmtMoney(outSum) + "</div></div>" +
      '<div class="ls-card ls-bal"><div class="ls-lbl">本月结余</div><div class="ls-num' + (bal < 0 ? " neg" : "") + '">' + fmtMoney(bal) + "</div></div>";

    $("#ledgerMonth").textContent = month.replace("-", " 年 ") + " 月";

    var list = $("#ledgerList");
    if (!recs.length) {
      list.innerHTML = '<div class="card"><div class="empty">本月还没有记录，用上方表单记一笔吧。</div></div>';
    } else {
      list.innerHTML = '<div class="ledger-list">' + recs.map(function (r) {
        var pos = r.type === "in";
        return '<div class="lr' + (pos ? " in" : "") + '">' +
          '<span class="lr-date">' + shortDate(r.date) + "</span>" +
          '<span class="tag ' + (pos ? "t-green" : "t-blue") + '">' + esc(r.cat) + "</span>" +
          '<span class="lr-note">' + esc(r.note || "") + "</span>" +
          '<span class="lr-amt ' + (pos ? "in" : "out") + '">' + (pos ? "+" : "−") + fmtMoney(r.amount) + "</span>" +
          '<button class="lr-del" data-id="' + esc(r.id) + '" title="删除" type="button">×</button>' +
          "</div>";
      }).join("") + "</div>";
    }

    // 支出分类占比
    var byCat = {};
    recs.forEach(function (r) { if (r.type === "out") byCat[r.cat] = (byCat[r.cat] || 0) + r.amount; });
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var box = $("#ledgerCats");
    if (!cats.length) {
      box.innerHTML = '<div class="sub-h">本月支出分类占比</div><div class="empty" style="padding:10px">本月暂无支出</div>';
    } else {
      var max = byCat[cats[0]];
      box.innerHTML = '<div class="sub-h">本月支出分类占比</div>' + cats.map(function (c) {
        var v = byCat[c];
        var pct = max ? Math.round(v / max * 100) : 0;
        var share = outSum ? Math.round(v / outSum * 100) : 0;
        return '<div class="lc-row"><span class="lc-name">' + esc(c) + "</span>" +
          '<span class="lc-bar"><span class="lc-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="lc-val">' + fmtMoney(v) + " · " + share + "%</span></div>";
      }).join("");
    }
  }

  function initLedger() {
    $$("#ledgerTypes label").forEach(function (lab) {
      var inp = lab.querySelector("input");
      inp.addEventListener("change", function () {
        $$("#ledgerTypes label").forEach(function (l) { l.classList.toggle("on", l.querySelector("input").checked); });
        updateCatOptions();
      });
    });
    updateCatOptions();
    $("#lfDate").value = TODAY;

    $("#ledgerF").addEventListener("submit", function (e) {
      e.preventDefault();
      var data = loadLedger();
      var checked = $("#ledgerTypes").querySelector("input:checked");
      var type = (checked && checked.value) || "out";
      var date = $("#lfDate").value || TODAY;
      var cat = $("#lfCat").value;
      var amt = parseFloat($("#lfAmt").value);
      if (!(amt > 0)) { $("#lfAmt").focus(); return; }
      data.records.push({
        id: "r" + Date.now() + Math.floor(Math.random() * 1000),
        date: date, type: type, cat: cat, amount: Math.round(amt * 100) / 100, note: ($("#lfNote").value || "").trim()
      });
      saveLedger(data);
      ledgerMonth = date.slice(0, 7);   // 记完跳到对应月份，立即看到
      $("#lfAmt").value = ""; $("#lfNote").value = "";
      renderLedger();
    });

    $("#ledgerList").addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".lr-del");
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      var data = loadLedger();
      data.records = data.records.filter(function (r) { return r.id !== id; });
      saveLedger(data);
      renderLedger();
    });

    $("#ledgerPrev").addEventListener("click", function () {
      var p = ledgerMonth.split("-"); var d = new Date(+p[0], +p[1] - 1, 1); d.setMonth(d.getMonth() - 1);
      ledgerMonth = d.getFullYear() + "-" + pad(d.getMonth() + 1); renderLedger();
    });
    $("#ledgerNext").addEventListener("click", function () {
      var p = ledgerMonth.split("-"); var d = new Date(+p[0], +p[1] - 1, 1); d.setMonth(d.getMonth() + 1);
      ledgerMonth = d.getFullYear() + "-" + pad(d.getMonth() + 1); renderLedger();
    });

    // 导出 / 导入备份（防清缓存、换设备丢失）
    $("#ledgerExport").addEventListener("click", function () {
      var payload = { kind: "workboard-backup", date: TODAY, ledger: loadLedger(), checkin: loadCheck() };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "workboard-backup-" + TODAY + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    });
    $("#ledgerImport").addEventListener("click", function () { $("#ledgerImportFile").click(); });
    $("#ledgerImportFile").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var d = JSON.parse(reader.result);
          if (d.ledger) saveLedger(d.ledger);
          if (d.checkin) saveCheck(d.checkin);
          renderLedger(); renderOverview();
          alert("备份已恢复 ✓");
        } catch (err) { alert("备份文件格式不正确，恢复失败"); }
      };
      reader.readAsText(f);
      e.target.value = "";
    });

    renderLedger();
  }

  /* ============ 6. 口才逻辑训练 ============ */
  function renderSpeech(date) {
    var list = WB.speech || [];
    var e = pickEntry(list, date || TODAY);
    var box = $("#speechBody");
    if (!e) { box.innerHTML = '<div class="empty">暂无训练内容</div>'; return; }

    var imp = '<div class="imp"><span class="tag t-violet">① 即兴口述 · ' + esc(e.impromptu.duration) + "</span>" +
      '<div class="imp-q">' + esc(e.impromptu.question) + "</div>" +
      '<ul class="imp-steps">' + e.impromptu.framework.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" +
      '<div class="imp-tip">' + esc(e.impromptu.tip) + "</div></div>";

    var tpls = '<div class="card card-pad"><div class="sub-h">② 结构化话术模板</div>' +
      e.templates.map(function (t) {
        return '<div class="tpl"><div class="tpl-head"><h4 class="tpl-scene">' + esc(t.scene) + "</h4>" +
          '<span class="tpl-struct">' + esc(t.structure) + "</span></div>" +
          t.script.map(function (s) {
            return '<div class="step"><div class="step-name">' + esc(s.step) + "</div>" +
              '<div class="step-say">' + esc(s.say) + "</div>" +
              '<div class="step-why">' + esc(s.why) + "</div></div>";
          }).join("") + "</div>";
      }).join('<hr style="border:0;border-top:1px solid var(--border);margin:18px 0">') + "</div>";

    var ana = '<div class="card card-pad"><div class="sub-h">③ 逻辑表达拆解范例</div>' +
      e.analysis.map(function (a) {
        return '<div class="ana">' +
          '<div class="ana-bad"><div class="ana-lbl">✗ 原句</div>' +
            '<div class="ana-txt">' + esc(a.bad) + "</div>" +
            '<ul class="ana-probs">' + a.problems.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul></div>" +
          '<div class="ana-good"><div class="ana-lbl">✓ 改写</div>' +
            '<div class="ana-txt">' + esc(a.good) + "</div></div>" +
          '<div class="ana-foot"><b>方法：</b>' + esc(a.rule) + "<br><b>底层原则：</b>" + esc(a.principle) + "</div>" +
        "</div>";
      }).join("") + "</div>";

    box.innerHTML = '<div style="margin-bottom:6px"><span class="tag t-gray">今日主题 · ' + esc(e.theme) + "</span></div>" +
      imp + '<div style="margin-top:14px">' + tpls + "</div>" +
      '<div style="margin-top:14px">' + ana + "</div>";

    var nav = $("#speechDates"); nav.innerHTML = "";
    nav.appendChild(datePills(list, e.date, renderSpeech));
  }

  /* ============ 导航高亮 ============ */
  function initNav() {
    var links = $$(".nav a");
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    function onScroll() {
      var y = window.scrollY + 120, idx = 0;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= y) idx = i; });
      links.forEach(function (a, i) { a.classList.toggle("on", i === idx); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ============ 启动 ============ */
  function boot() {
    document.title = (META.boardName || "Workboard") + " · " + TODAY;
    $("#footMeta").textContent =
      "数据更新：" + (META.lastUpdate || "—") + " ｜ 消防抓取范围：" + (META.fireScope || "—");
    $("#agentSign").textContent = META.agent ? ("by " + META.agent) : "";

    initFire();          // 需先算出在招数量供总览使用
    renderOverview();
    renderEnglish(TODAY);
    renderNews(TODAY);
    renderFinance(TODAY);
    initLedger();
    renderSpeech(TODAY);
    initNav();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
