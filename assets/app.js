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

  /* 朗读 / 跟读（浏览器内置 Web Speech API） */
  var synth = window.speechSynthesis || null;
  var EN_RATE = 0.8;      // 跟读速度，默认 0.8× 慢速，方便跟读
  var EN_SHOW_ZH = true;  // 是否显示中文翻译
  function getRate() { var el = $("#enRate"); return el ? (parseFloat(el.value) || 0.8) : EN_RATE; }
  function enc(s) { return encodeURIComponent(String(s == null ? "" : s)); }
  function speak(text, btn) {
    if (!synth) return;
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = getRate(); u.pitch = 1;
    if (btn) {
      u.onstart = function () { btn.classList.add("speaking"); };
      u.onend = u.onerror = function () { btn.classList.remove("speaking"); };
    }
    synth.speak(u);
  }
  function shadowRead() {
    if (!synth) { alert("当前浏览器不支持语音朗读"); return; }
    var btns = $$("#englishBody .dlg-line .spk");
    if (!btns.length) return;
    synth.cancel();
    var rate = getRate();
    btns.forEach(function (b) {
      var u = new SpeechSynthesisUtterance(decodeURIComponent(b.getAttribute("data-en")));
      u.lang = "en-US"; u.rate = rate;
      u.onstart = function () { btns.forEach(function (x) { x.classList.remove("speaking"); }); b.classList.add("speaking"); };
      u.onend = function () { b.classList.remove("speaking"); };
      synth.speak(u);
    });
  }

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
    return; /* 每日英语模块已移除 */
    var list = WB.english || [];
    var e = pickEntry(list, date || TODAY);
    var box = $("#englishBody");
    if (!e) { box.innerHTML = '<div class="empty">暂无素材</div>'; return; }

    box.innerHTML =
      '<div class="en-tools">' +
        '<button class="btn" id="enShadow" type="button">▶ 跟读模式 · 逐句朗读</button>' +
        '<label class="en-opt">朗读速度' +
          '<select id="enRate" class="en-rate">' +
            '<option value="0.6">0.6× 慢</option>' +
            '<option value="0.8" selected>0.8×</option>' +
            '<option value="1">1.0× 常速</option>' +
            '<option value="1.2">1.2× 快</option>' +
          '</select></label>' +
        '<label class="en-opt en-zh-opt"><input type="checkbox" id="enZh" checked> 显示中文翻译</label>' +
        '<span class="en-tools-hint">点 🔊 单句跟读，或一键逐句播放并高亮</span>' +
      '</div>' +
      '<div class="grid2">' +
        '<div class="card card-pad">' +
          '<h3 class="en-scene">' + esc(e.scene) + "</h3>" +
          '<div class="en-goal">' + esc(e.goal) + "</div>" +
          '<div class="sub-h">情景对话</div>' +
          '<div class="dlg">' +
            e.dialogue.map(function (l) {
              return '<div class="dlg-line' + (/you/i.test(l.role) ? " you" : "") + '">' +
                '<div class="dlg-role">' + esc(l.role) + "</div>" +
                '<div class="dlg-body"><div class="dlg-txt"><div class="dlg-en">' + esc(l.en) + "</div>" +
                '<div class="dlg-zh">' + esc(l.zh) + "</div></div>" +
                '<button class="spk" type="button" data-en="' + enc(l.en) + '" title="朗读">🔊</button></div></div>';
            }).join("") +
          "</div>" +
        "</div>" +
        "<div>" +
          '<div class="card card-pad" style="margin-bottom:14px">' +
            '<div class="sub-h">高频短句 · 背下来直接能用</div>' +
            '<ul class="phr">' + e.phrases.map(function (p) {
              return "<li><button class=\"spk\" type=\"button\" data-en=\"" + enc(p.en) + "\" title=\"朗读\">🔊</button>" +
                "<div class=\"p-txt\"><div class=\"p-en\">" + esc(p.en) + "</div><div class=\"p-zh\">" + esc(p.zh) + "</div></div></li>";
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

    // 跟读速度 / 中英对照开关（状态跨日期保留）
    var rateEl = $("#enRate");
    if (rateEl) {
      rateEl.value = String(EN_RATE);
      rateEl.addEventListener("change", function () { EN_RATE = parseFloat(rateEl.value) || 0.8; });
    }
    var zhEl = $("#enZh");
    if (zhEl) {
      zhEl.checked = EN_SHOW_ZH;
      box.classList.toggle("hide-zh", !EN_SHOW_ZH);
      zhEl.addEventListener("change", function () {
        EN_SHOW_ZH = zhEl.checked;
        box.classList.toggle("hide-zh", !EN_SHOW_ZH);
      });
    }
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
        var excerpt = n.excerpt
          ? '<div class="news-excerpt">“' + esc(n.excerpt) + '”</div>'
          : "";
        return '<div class="news-item">' +
          '<div class="news-head"><span class="tag t-blue">' + esc(n.tag) + "</span>" +
          '<div class="news-title">' + esc(n.title) + "</div>" +
          '<span class="news-toggle"></span></div>' +
          '<div class="news-extra">' +
          excerpt +
          '<div class="news-digest">' + esc(n.digest) + "</div>" +
          '<div class="news-angle">' + esc(n.angle) + "</div>" +
          '<div class="news-src">来源：' + esc(n.source) +
            ' · <a class="news-link" href="https://www.baidu.com/s?wd=' + enc(n.title) +
            '" target="_blank" rel="noopener" title="按标题搜索，定位人民网等官媒原文">搜原文 ↗</a>' +
          "</div></div></div>";
      }).join("") + "</div></div>";

    var nav = $("#newsDates"); nav.innerHTML = "";
    nav.appendChild(datePills(list, e.date, renderNews));
  }

  /* ============ 4. 财经资讯 ============ */
  function mktCard(lbl, val, cls) {
    if (val == null) return "";
    return '<div class="mkt"><div class="mkt-lbl">' + esc(lbl) + '</div><div class="mkt-val ' + esc(cls) + '">' + esc(val) + "</div></div>";
  }

  function renderFinance(date) {
    var list = WB.finance || [];
    var e = pickEntry(list, date || TODAY);
    var box = $("#financeBody");
    if (!e) { box.innerHTML = '<div class="empty">暂无数据</div>'; return; }

    var m = e.market || {};
    var mk = '<div class="mkt-cards">' +
      mktCard("主力净流入", m.mainNet, m.mainNet && m.mainNet.indexOf("净流出") >= 0 ? "neg" : "pos") +
      mktCard("北向资金", m.northbound, m.northbound && m.northbound.indexOf("净流出") >= 0 ? "neg" : "pos") +
      mktCard("两市成交额", m.turnover, "") +
      mktCard("市场情绪", m.sentiment, "") +
      "</div>";

    var secs = e.sectors || [];
    var maxVol = 1;
    secs.forEach(function (s) { var v = Math.abs(s.vol || 0); if (v > maxVol) maxVol = v; });
    var sf = secs.length ? '<div class="card card-pad"><div class="sub-h">板块资金流向（按净流入排序）</div><div class="sector-flow">' +
      secs.map(function (s) {
        var w = Math.round(Math.abs(s.vol || 0) / maxVol * 100);
        var dirCls = s.dir === "out" ? "down" : "up";
        var val = (s.dir === "out" ? "净流出 " : "净流入 ") + (s.vol != null ? s.vol + " 亿" : "") + (s.change ? " · " + s.change : "");
        return '<div class="sf-row"><div class="sf-name">' + esc(s.name) + "</div>" +
          '<div class="sf-bar"><span class="sf-fill ' + dirCls + '" style="width:' + w + '%"></span></div>' +
          '<div class="sf-val ' + dirCls + '">' + esc(val) + (s.note ? ' <span class="sf-note">' + esc(s.note) + "</span>" : "") + "</div></div>";
      }).join("") + "</div></div>" : "";

    var watch = (e.watch && e.watch.length) ? '<div class="card card-pad"><div class="sub-h">值得留意的信号</div><ul class="fin-watch">' +
      e.watch.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul></div>" : "";

    box.innerHTML =
      '<div class="fin-summary">' + esc(e.summary || "") + "</div>" +
      mk +
      '<div style="margin-top:14px">' + sf + "</div>" +
      '<div style="margin-top:14px">' + watch + "</div>" +
      (e.risk ? '<div class="risk-note" style="margin-top:14px">' + esc(e.risk) + "</div>" : "");

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
    try { localStorage.setItem(LEDGER_KEY, JSON.stringify(o)); return true; }
    catch (e) { return false; }
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
      e.preventDefault();
      var id = btn.getAttribute("data-id");
      var data = loadLedger();
      var before = data.records.length;
      data.records = data.records.filter(function (r) { return String(r.id) !== String(id); });
      if (data.records.length === before) return; // 没匹配到，直接忽略
      if (!saveLedger(data)) {
        alert("删除未能保存：当前浏览器（多为微信/QQ内置浏览器或无痕模式）禁止了本地存储。\n请改用手机自带 Chrome / Safari 的「正常模式」打开本页面，记账与删除即可长期保存。");
        renderLedger();
        return;
      }
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
    if (!e) { box.innerHTML = '<div class="empty">暂无内容</div>'; return; }

    var art = e.article || {};
    var body = (art.body || []).map(function (p) { return "<p>" + md(p) + "</p>"; }).join("");
    var artHTML = '<div class="read-article">' +
      '<div class="ra-meta">' +
        (art.title ? '<span class="ra-title">' + esc(art.title) + "</span>" : "") +
        (art.author ? '<span class="ra-author">' + esc(art.author) + "</span>" : "") +
        (art.source ? '<span class="ra-src">来源：' + esc(art.source) + "</span>" : "") +
      "</div>" +
      '<div class="ra-body">' + body + "</div>" +
      (art.why ? '<div class="ra-why"><b>为什么读这篇：</b>' + esc(art.why) + "</div>" : "") +
      "</div>";

    var refl = (e.reflection && e.reflection.length) ? '<div class="card card-pad"><div class="sub-h">今日思维练习</div><ul class="refl">' +
      e.reflection.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></div>" : "";

    var quotes = (e.quotes && e.quotes.length) ? '<div class="card card-pad"><div class="sub-h">可积累的金句</div>' +
      e.quotes.map(function (q) { return '<div class="quote">“' + esc(q) + '”</div>'; }).join("") + "</div>" : "";

    box.innerHTML = '<div style="margin-bottom:6px"><span class="tag t-violet">今日主题 · ' + esc(e.theme || "") + "</span></div>" +
      artHTML +
      '<div style="margin-top:14px">' + refl + "</div>" +
      '<div style="margin-top:14px">' + quotes + "</div>";

    var nav = $("#speechDates"); nav.innerHTML = "";
    nav.appendChild(datePills(list, e.date, renderSpeech));
  }

  /* ============ 导航 · 单视图切换 ============ */
  var VIEWS = ["overview", "fire", "news", "finance", "ledger", "speech"];
  function setView(key) {
    VIEWS.forEach(function (v) {
      var el = document.getElementById(v);
      if (el) el.classList.toggle("view-active", v === key);
    });
    var foot = document.querySelector(".foot");
    if (foot) foot.classList.toggle("view-active", key === "overview");
    $$(".side-nav a").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("href") === "#" + key);
    });
  }
  function initTheme() {
    var KEY = "wb_theme";
    function apply(t) {
      document.body.classList.remove("theme-light", "theme-dark");
      document.body.classList.add("theme-" + t);
      $$(".ts-btn").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-theme") === t); });
    }
    var saved = "light";
    try { saved = localStorage.getItem(KEY) || "light"; } catch (e) {}
    apply(saved);
    $$(".ts-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-theme");
        apply(t);
        try { localStorage.setItem(KEY, t); } catch (e) {}
      });
    });
  }
  function initNav() {
    $$(".side-nav a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        setView(a.getAttribute("href").slice(1));
        try { window.scrollTo(0, 0); } catch (e2) {}
      });
    });
  }

  /* ============ 启动 ============ */
  function boot() {
    document.title = (META.boardName || "Workboard") + " · " + TODAY;
    $("#footMeta").textContent =
      "数据更新：" + (META.lastUpdate || "—") + " ｜ 消防抓取范围：" + (META.fireScope || "—");
    $("#agentSign").textContent = META.agent ? ("by " + META.agent) : "";
    var ag2 = $("#agentSign2"); if (ag2) ag2.textContent = META.agent ? ("by " + META.agent) : "";

    initTheme();         // 浅紫模板 + 白/黑底切换（须在渲染前）
    initFire();          // 需先算出在招数量供总览使用
    renderOverview();
    renderNews(TODAY);
    renderFinance(TODAY);
    initLedger();
    renderSpeech(TODAY);
    initNav();
    setView("overview");   // 默认只显示总览，点左侧导航切换单模块

    // 全局点击：资讯手风琴展开
    document.addEventListener("click", function (e) {
      var item = e.target.closest && e.target.closest(".news-item, .fin-item");
      if (item) {
        if (e.target.closest("a")) return;   // 点原文链接不折叠
        item.classList.toggle("open");
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
