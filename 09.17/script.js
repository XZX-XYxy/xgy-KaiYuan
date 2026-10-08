(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var live = document.getElementById("live");
  var toTop = document.getElementById("toTop");

  /* 首屏终端逐字输出 */
  var term = document.getElementById("terminal");
  var codeEl = term ? term.querySelector("code") : null;
  var script = [
    { cmd: "whoami", out: "徐郭源 · 上海杉达学院 · 数据科学与大数据技术" },
    { cmd: "cat about.md", out: "责任心强，做事有条理，\n习惯提前规划、按时交付。" },
    { cmd: "ls ./now", out: "暑期实习（寻找中）" }
  ];

  var done = 0;    // 已完整输出的命令数
  var typed = 0;   // 当前命令已输入的字符数

  function renderTerminal(full) {
    if (!codeEl) return;
    var html = "";
    script.forEach(function (block, i) {
      if (full || i < done) {
        html += '<span class="cmd">$ ' + block.cmd + "</span>\n" +
                '<span class="dim">' + block.out + "</span>\n\n";
      } else if (i === done) {
        html += '<span class="cmd">$ ' + block.cmd.slice(0, typed) + "</span>";
      }
    });
    codeEl.innerHTML = html;
  }

  renderTerminal(reduce);

  if (codeEl && !reduce) {
    var typeTimer = setInterval(function () {
      var block = script[done];
      if (!block) { clearInterval(typeTimer); return; }
      typed++;
      if (typed > block.cmd.length) {
        done++;
        typed = 0;
        renderTerminal(false);
        return;
      }
      renderTerminal(false);
    }, 62);
  }

  /* 选项卡 */
  var tablist = document.getElementById("tablist");
  var ink = document.getElementById("tabInk");
  if (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));

    function moveInk(tab) {
      if (!ink) return;
      ink.style.left = tab.offsetLeft + "px";
      ink.style.width = tab.offsetWidth + "px";
    }

    function selectTab(tab, focus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !selected;
      });
      moveInk(tab);
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { selectTab(tab, false); });
      tab.addEventListener("keydown", function (event) {
        var index = tabs.indexOf(tab);
        var next = null;
        if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
        if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
        if (event.key === "Home") next = tabs[0];
        if (event.key === "End") next = tabs[tabs.length - 1];
        if (next) {
          event.preventDefault();
          selectTab(next, true);
        }
      });
    });

    var current = tablist.querySelector('[aria-selected="true"]') || tabs[0];
    if (current) selectTab(current, false);
    window.addEventListener("resize", function () {
      var active = tablist.querySelector('[aria-selected="true"]') || tabs[0];
      if (active) moveInk(active);
    });
  }

  /* 进场动画与导航高亮 */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 }
    );
    reveals.forEach(function (el) { revealObserver.observe(el); });

    var navLinks = Array.prototype.slice.call(document.querySelectorAll("#topNav a"));
    var sections = navLinks
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (a) {
            a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach(function (s) { spy.observe(s); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  window.addEventListener("scroll", function () {
    if (toTop) toTop.classList.toggle("is-on", window.scrollY > 700);
  }, { passive: true });

  /* 复制邮箱 */
  var copyBtn = document.getElementById("copyMail");
  if (copyBtn) {
    var label = copyBtn.querySelector("span");
    var timer;
    copyBtn.addEventListener("click", function () {
      var text = copyBtn.getAttribute("data-mail") || "";
      var finish = function () {
        copyBtn.classList.add("is-copied");
        if (label) label.textContent = "已复制";
        if (live) live.textContent = "邮箱已复制到剪贴板";
        clearTimeout(timer);
        timer = setTimeout(function () {
          copyBtn.classList.remove("is-copied");
          if (label) label.textContent = "复制邮箱";
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(finish, function () {});
      } else {
        var area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); finish(); } catch (err) {}
        document.body.removeChild(area);
      }
    });
  }
})();
