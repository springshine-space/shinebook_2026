/* shine book · 공통 플립북 스크립트
   각 작가 폴더의 index.html 에서 window.FLIPBOOK 설정만 바꿔서 사용합니다.

   설정 예)
   window.FLIPBOOK = {
     title: "은방울꽃처럼",     // 책 제목
     artist: "그린",            // 작가명
     pages: 23,                 // pages 폴더의 이미지 개수 (01.webp ~ 23.webp)
     copyright: "© 2026 그린 & 스프링샤인"
   };
*/
(function () {
  "use strict";

  var cfg = window.FLIPBOOK || {};
  var N = cfg.pages | 0;                       // 실제 이미지 쪽수
  if (!N) return;

  var DIR = cfg.dir || "pages/";
  var EXT = cfg.ext || "webp";
  var ASSETS = cfg.assets || "../assets/";
  var RATIO = cfg.ratio || 552.756 / 637.795;   // 한 쪽의 가로/세로 비율
  var ZOOM = cfg.zoom || 2;                     // 확대 배율
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DUR = reduce ? 30 : 850;

  // 이미지 쪽수가 홀수면 뒷표지(자동 생성)를 하나 붙여 짝수로 맞춥니다.
  var hasEnd = N % 2 === 1;
  var total = hasEnd ? N + 1 : N;
  var leafCount = total / 2;                    // 종이 장수 (앞뒤 2쪽)

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), book = $("book"), loading = $("loading");
  var btnPrev = $("prev"), btnNext = $("next"), btnZoom = $("zoom"), btnFs = $("fs");
  var label = $("label"), prog = $("prog").firstElementChild;

  var mode = null;          // 'spread' | 'single'
  var state = 0;            // 펼침면: 넘겨진 장 수 (0 ~ leafCount)
  var cur = 1;              // 한 쪽씩 보기: 현재 쪽 (1 ~ total)
  var zoomed = false;
  var leaves = [];
  var sps = [];
  var shL, shR;
  var loaded = {};

  /* ---------- 유틸 ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function url(n) { return DIR + pad(n) + "." + EXT; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- 이미지 로딩 (필요한 쪽부터, 나머지는 천천히) ---------- */
  function setBg(n) {
    var nodes = book.querySelectorAll('[data-p="' + n + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].style.backgroundImage = "url(" + url(n) + ")";
  }
  function load(n, cb) {
    if (n < 1 || n > N) { if (cb) cb(); return; }
    if (loaded[n]) { if (loaded[n] === 2) setBg(n); if (cb) cb(); return; }
    loaded[n] = 1;
    var img = new Image();
    img.onload = img.onerror = function () { loaded[n] = 2; setBg(n); if (cb) cb(); };
    img.src = url(n);
  }
  function visiblePage() {
    if (mode === "single") return cur;
    return state === 0 ? 1 : state === leafCount ? total : state * 2;
  }
  function ensureAround() {
    var c = visiblePage();
    [c, c + 1, c - 1, c + 2, c - 2, c + 3].forEach(function (n) { load(n); });
  }
  function backgroundLoad() {
    var order = [];
    var c = visiblePage();
    for (var d = 0; d <= N; d++) { if (c + d <= N) order.push(c + d); if (d && c - d >= 1) order.push(c - d); }
    var i = 0;
    (function next() {
      while (i < order.length && loaded[order[i]]) i++;
      if (i >= order.length) return;
      load(order[i], function () { setTimeout(next, 60); });
    })();
  }

  /* ---------- DOM 만들기 ---------- */
  function fillEnd(d) {
    d.className += " end";
    d.innerHTML =
      '<div class="end-in">' +
      '<img class="logo" src="' + esc(ASSETS) + 'logo.webp" alt="스프링샤인" draggable="false">' +
      '<p class="e-title">' + esc(cfg.title) + '</p>' +
      '<p class="e-artist">' + esc(cfg.artist) + ' 지음</p>' +
      '<p class="e-copy">' + esc(cfg.copyright || "") + '<br>All rights reserved.' +
      (cfg.homepage ? '<br><a href="' + esc(cfg.homepage) + '" target="_blank" rel="noopener">' + esc(cfg.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "")) + '</a>' : "") +
      '</p></div>';
  }
  function makeFace(n, cls) {
    var d = el("div", cls);
    d.setAttribute("data-p", n);
    if (n <= N) { d.setAttribute("role", "img"); d.setAttribute("aria-label", n + "쪽"); }
    else fillEnd(d);
    return d;
  }
  function zFinal(i, flipped) { return flipped ? 10 + i : 10 + (leafCount - i); }

  function buildSpread() {
    book.className = "";
    book.innerHTML = "";
    leaves = []; sps = [];
    shL = el("div", "sh"); shL.id = "shL";
    shR = el("div", "sh"); shR.id = "shR";
    book.appendChild(shL); book.appendChild(shR);
    for (var i = 0; i < leafCount; i++) {
      var lf = el("div", "leaf");
      lf.appendChild(makeFace(2 * i + 1, "face front"));
      lf.appendChild(makeFace(2 * i + 2, "face back"));
      var flipped = i < state;
      if (flipped) lf.className += " flipped";
      lf.style.zIndex = zFinal(i, flipped);
      book.appendChild(lf);
      leaves.push({ el: lf, flipped: flipped, tok: 0 });
    }
  }
  function buildSingle() {
    book.className = "single";
    book.innerHTML = "";
    leaves = []; sps = [];
    for (var n = 1; n <= total; n++) {
      var d = makeFace(n, "sp");
      sps.push(d);
      book.appendChild(d);
    }
    paintSingle();
  }
  function paintSingle() {
    for (var i = 0; i < sps.length; i++) {
      var n = i + 1;
      sps[i].classList.toggle("cur", n === cur);
      sps[i].classList.toggle("before", n < cur);
    }
  }

  /* ---------- 크기 계산 ---------- */
  function layout() {
    var W = stage.offsetWidth, H = stage.offsetHeight;   // 스크롤바 유무와 상관없이 일정한 값
    var want = zoomed ? mode : (W >= 700 ? "spread" : "single");
    if (want !== mode) switchMode(want);

    var pw;
    if (mode === "spread") pw = Math.min((W - 48) / 2, (H - 32) * RATIO);
    else pw = Math.min(W - 24, (H - 24) * RATIO);
    pw = Math.max(120, Math.floor(pw));
    if (zoomed) pw = Math.floor(pw * ZOOM);
    pw -= pw % 2;
    var ph = Math.round(pw / RATIO);
    var root = document.documentElement.style;
    root.setProperty("--pw", pw + "px");
    root.setProperty("--ph", ph + "px");
  }

  function switchMode(want) {
    var old = mode;
    mode = want;
    if (old === "spread") cur = state === 0 ? 1 : state === leafCount ? total : state * 2;
    if (old === "single") state = cur <= 1 ? 0 : cur >= total ? leafCount : Math.floor(cur / 2);
    if (mode === "spread") buildSpread(); else buildSingle();
    if (zoomed) setZoom(false);
    book.classList.add("instant");
    updateBook();
    updateUI();
    ensureAround();
    void book.offsetWidth;
    book.classList.remove("instant");
    Object.keys(loaded).forEach(function (k) { if (loaded[k] === 2) setBg(+k); });
  }

  /* ---------- 펼침면 동작 ---------- */
  function updateBook() {
    if (mode !== "spread") return;
    var tx = 0;
    if (!zoomed) { if (state === 0) tx = -25; else if (state === leafCount) tx = 25; }
    book.style.transform = "translateX(" + tx + "%)";
    shL.style.opacity = state > 0 ? 1 : 0;
    shR.style.opacity = state < leafCount ? 1 : 0;
  }

  function setState(s, animate) {
    s = clamp(s, 0, leafCount);
    if (s === state) return;
    var fwd = s > state;
    state = s;

    var moving = [];
    for (var i = 0; i < leafCount; i++) if (leaves[i].flipped !== (i < s)) moving.push(i);
    if (!fwd) moving.reverse();
    var gap = animate ? Math.min(90, 600 / Math.max(1, moving.length)) : 0;

    moving.forEach(function (i, k) {
      var lf = leaves[i];
      var should = i < s;
      lf.flipped = should;
      var tok = ++lf.tok;
      function go() {
        if (tok !== lf.tok) return;
        lf.el.style.zIndex = 500 + (fwd ? i : leafCount - i);
        if (animate) lf.el.classList.add("turning");
        lf.el.classList.toggle("flipped", should);
        setTimeout(function () {
          if (tok !== lf.tok) return;
          lf.el.classList.remove("turning");
          lf.el.style.zIndex = zFinal(i, should);
        }, DUR + 40);
      }
      if (!animate) {
        book.classList.add("instant");
        go();
        void book.offsetWidth;
        book.classList.remove("instant");
      } else if (k === 0) go();
      else setTimeout(go, k * gap);
    });

    updateBook();
    afterMove();
  }

  /* ---------- 한 쪽씩 보기 동작 ---------- */
  function setCur(n) {
    n = clamp(n, 1, total);
    if (n === cur) return;
    cur = n;
    paintSingle();
    afterMove();
  }

  /* ---------- 공통 이동 ---------- */
  function afterMove() {
    updateUI();
    ensureAround();
    if (zoomed) centerVisible();
  }
  function next() { if (mode === "spread") setState(state + 1, true); else setCur(cur + 1); }
  function prev() { if (mode === "spread") setState(state - 1, true); else setCur(cur - 1); }
  function first() { if (mode === "spread") setState(0, true); else setCur(1); }
  function last() { if (mode === "spread") setState(leafCount, true); else setCur(total); }
  function goPage(p) {
    p = clamp(p, 1, total);
    if (mode === "spread") setState(p <= 1 ? 0 : p >= total ? leafCount : Math.floor(p / 2), false);
    else setCur(p);
  }

  /* ---------- 표시 갱신 ---------- */
  function updateUI() {
    var text, ratio, atStart, atEnd;
    if (mode === "spread") {
      atStart = state === 0; atEnd = state === leafCount;
      ratio = state / leafCount;
      text = atStart ? "표지" : atEnd ? "뒷표지" : state * 2 + "–" + (state * 2 + 1) + " / " + N;
    } else {
      atStart = cur === 1; atEnd = cur === total;
      ratio = (cur - 1) / (total - 1);
      text = atStart ? "표지" : atEnd ? "뒷표지" : cur + " / " + N;
    }
    label.textContent = text;
    prog.style.width = Math.round(ratio * 100) + "%";
    btnPrev.disabled = atStart;
    btnNext.disabled = atEnd;
  }

  /* ---------- 확대 ---------- */
  function setZoom(on, cx, cy) {
    if (on === zoomed) return;
    var sr = stage.getBoundingClientRect();
    if (cx == null) { cx = sr.left + sr.width / 2; cy = sr.top + sr.height / 2; }
    var r = book.getBoundingClientRect();
    var fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;

    book.classList.add("instant");
    zoomed = on;
    stage.classList.toggle("zoomed", on);
    btnZoom.setAttribute("aria-pressed", on ? "true" : "false");
    btnZoom.setAttribute("aria-label", on ? "축소" : "확대");
    btnZoom.querySelector(".i-in").style.display = on ? "none" : "";
    btnZoom.querySelector(".i-out").style.display = on ? "" : "none";
    layout();
    updateBook();
    if (on) {
      var b = book.getBoundingClientRect();
      stage.scrollLeft = fx * b.width - (cx - sr.left);
      stage.scrollTop = fy * b.height - (cy - sr.top);
    } else {
      stage.scrollLeft = 0; stage.scrollTop = 0;
    }
    void book.offsetWidth;
    book.classList.remove("instant");
  }
  function centerVisible() {
    var w = book.offsetWidth, h = book.offsetHeight;
    var fx = mode === "single" ? 0.5 : state === 0 ? 0.75 : state === leafCount ? 0.25 : 0.5;
    stage.scrollLeft = fx * w - stage.clientWidth / 2;
    stage.scrollTop = h / 2 - stage.clientHeight / 2;
  }

  /* ---------- 전체화면 ---------- */
  var root = document.documentElement;
  var fsOK = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  function isFs() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function toggleFs() {
    if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  }
  function fsChanged() {
    var on = !!isFs();
    btnFs.setAttribute("aria-pressed", on ? "true" : "false");
    btnFs.setAttribute("aria-label", on ? "전체화면 종료" : "전체화면");
    setTimeout(layout, 50);
  }
  if (!fsOK) btnFs.hidden = true;
  document.addEventListener("fullscreenchange", fsChanged);
  document.addEventListener("webkitfullscreenchange", fsChanged);

  /* ---------- 입력 ---------- */
  btnNext.addEventListener("click", next);
  btnPrev.addEventListener("click", prev);
  btnZoom.addEventListener("click", function () { setZoom(!zoomed); });
  btnFs.addEventListener("click", toggleFs);

  var dragMoved = false;
  book.addEventListener("click", function (e) {
    if (zoomed || dragMoved) return;
    if (e.target.closest && e.target.closest("a")) return;
    var r = book.getBoundingClientRect();
    if (mode === "spread") (e.clientX < r.left + r.width / 2) ? prev() : next();
    else (e.clientX < r.left + r.width * 0.35) ? prev() : next();
  });

  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); next(); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); prev(); }
    else if (k === "Home") { e.preventDefault(); first(); }
    else if (k === "End") { e.preventDefault(); last(); }
    else if (k === "Escape" && zoomed) setZoom(false);
    else if (k === "+" || k === "=") setZoom(true);
    else if (k === "-" || k === "_") setZoom(false);
    else if ((k === "f" || k === "F") && fsOK) toggleFs();
  });

  // 터치 스와이프
  var tx0 = 0, ty0 = 0, tt0 = 0;
  stage.addEventListener("touchstart", function (e) {
    if (zoomed || e.touches.length !== 1) return;
    tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; tt0 = Date.now();
  }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (zoomed || !e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - tx0, dy = e.changedTouches[0].clientY - ty0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - tt0 < 800) {
      dx < 0 ? next() : prev();
    }
  }, { passive: true });

  // 확대 상태에서 마우스로 끌어 이동
  var drag = null;
  stage.addEventListener("mousedown", function (e) {
    if (!zoomed || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
    dragMoved = false;
    stage.classList.add("drag");
  });
  window.addEventListener("mousemove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
    stage.scrollLeft = drag.sl - dx;
    stage.scrollTop = drag.st - dy;
  });
  window.addEventListener("mouseup", function () {
    if (!drag) return;
    drag = null;
    stage.classList.remove("drag");
    setTimeout(function () { dragMoved = false; }, 0);
  });

  // 이미지 저장 억제 (완전한 차단은 불가능하며, 일반 관람객 대상의 예방 조치입니다)
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });

  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(layout, 80); });

  /* ---------- 시작 ---------- */
  function start() {
    var m = (location.hash || "").match(/(\d+)/) || (location.search || "").match(/page=(\d+)/);
    var startPage = m ? clamp(parseInt(m[1], 10), 1, total) : 1;

    stage.classList.remove("zoomed");
    var W = stage.offsetWidth;
    mode = W >= 700 ? "spread" : "single";
    if (mode === "spread") { state = startPage <= 1 ? 0 : startPage >= total ? leafCount : Math.floor(startPage / 2); buildSpread(); }
    else { cur = startPage; buildSingle(); }

    book.classList.add("instant");
    layout();
    updateBook();
    updateUI();
    void book.offsetWidth;
    book.classList.remove("instant");

    var opened = false;
    function open() { if (opened) return; opened = true; loading.classList.add("done"); backgroundLoad(); }
    load(visiblePage(), open);
    ensureAround();
    setTimeout(open, 2500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
