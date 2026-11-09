document.documentElement.classList.add("js");

(function () {
  "use strict";

  var body = document.body;
  var header = document.getElementById("siteHeader");
  var progress = document.getElementById("scrollProgress");
  var menuToggle = document.getElementById("menuToggle");
  var mobileMenu = document.getElementById("mobileMenu");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".desktop-nav a"));
  var mobileLinks = Array.prototype.slice.call(document.querySelectorAll(".mobile-menu a"));
  var revealItems = document.querySelectorAll(
    ".section-heading, .feature-project, .project-visual-story, .project-card, .audit-project, .capability, .timeline li, .video-feature, .open-source-certificate-page, .primary-credential, .micro-credentials, .contact__top, .contact__actions"
  );
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function closeMenu() {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "打开导航菜单");
    mobileMenu.setAttribute("aria-hidden", "true");
    mobileMenu.classList.remove("is-open");
    body.classList.remove("nav-open");
  }

  function openMenu() {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "关闭导航菜单");
    mobileMenu.setAttribute("aria-hidden", "false");
    mobileMenu.classList.add("is-open");
    body.classList.add("nav-open");
  }

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", function () {
      var isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    mobileLinks.forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  function updateScrollState() {
    var scrollTop = window.scrollY || window.pageYOffset;
    var pageHeight = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = pageHeight > 0 ? Math.min(scrollTop / pageHeight, 1) : 0;

    if (progress) progress.style.width = (ratio * 100).toFixed(2) + "%";
    if (header) header.classList.toggle("is-scrolled", scrollTop > 24);
  }

  window.addEventListener("scroll", updateScrollState, { passive: true });
  window.addEventListener("resize", updateScrollState);
  updateScrollState();

  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    revealItems.forEach(function (item, index) {
      item.classList.add("reveal");
      item.style.transitionDelay = Math.min(index % 4, 3) * 45 + "ms";
      revealObserver.observe(item);
    });
  }

  if ("IntersectionObserver" in window) {
    var sectionMap = {
      projects: "projects",
      capabilities: "capabilities",
      journey: "journey",
      "open-source-certification": "credentials",
      credentials: "credentials",
      contact: "contact"
    };

    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var current = sectionMap[entry.target.id];
          navLinks.forEach(function (link) {
            link.classList.toggle("is-active", link.dataset.section === current);
          });
        });
      },
      { rootMargin: "-34% 0px -58% 0px", threshold: 0 }
    );

    Object.keys(sectionMap).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) sectionObserver.observe(section);
    });
  }

  var copyButton = document.getElementById("copyEmail");
  var copyLabel = document.getElementById("copyEmailLabel");
  var toast = document.getElementById("toast");
  var toastTimer;

  function showCopied() {
    if (copyLabel) copyLabel.textContent = "已复制到剪贴板";
    if (toast) {
      toast.classList.add("is-visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toast.classList.remove("is-visible");
      }, 1800);
    }
    setTimeout(function () {
      if (copyLabel) copyLabel.textContent = "复制邮箱地址";
    }, 1800);
  }

  function fallbackCopy(text) {
    var input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
      showCopied();
    } catch (error) {
      if (copyLabel) copyLabel.textContent = "请手动复制";
    }
    document.body.removeChild(input);
  }

  if (copyButton) {
    copyButton.addEventListener("click", function () {
      var email = copyButton.getAttribute("data-email") || "";
      if (!email) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(showCopied, function () {
          fallbackCopy(email);
        });
      } else {
        fallbackCopy(email);
      }
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
