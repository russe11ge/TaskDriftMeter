(async function () {
  const App = window.AppState;
  if (!App) return;

  const groupId = App.getCurrentGroupId();
  if (!groupId) {
    location.href = "./dashboard.html";
    return;
  }

  const $ = (sel) => document.querySelector(sel);

  const titleEl = $("#groupTitle");
  const topRightBtn = $("#topRightBtn");
  const topLeftBtn = $("#topLeftBtn");
  const plusBtn = $("#openLogBtn");
  const recentList = $("#recentList");
  const overviewBox = $("#overviewBox");
  const donutWrap = $("#donutWrap");

  const bottomLeftBtn = $("#navGroupView");
  const bottomCenterBtn = $("#navDashboard");
  const bottomRightBtn = $("#navTime");

  let currentGroup = null;

  try {
    const { fbGetGroupById } = await import("./firebase-data.js");
    currentGroup = await fbGetGroupById(groupId);

    if (!currentGroup) {
      location.href = "./dashboard.html";
      return;
    }
  } catch (e) {
    console.error(e);
    location.href = "./dashboard.html";
    return;
  }

  if (titleEl) {
    titleEl.textContent = String(currentGroup.name || "Group View");
  }

  if (topRightBtn) {
    App.applyTopRightAvatar(topRightBtn);
    topRightBtn.addEventListener("click", () => {
      location.href = "./profile.html";
    });
  }

  if (topLeftBtn) {
    topLeftBtn.addEventListener("click", () => {
      location.href = "./dashboard.html";
    });
  }

  if (bottomLeftBtn) {
    bottomLeftBtn.classList.add("active");
    bottomLeftBtn.addEventListener("click", () => {});
  }

  if (bottomCenterBtn) {
    bottomCenterBtn.addEventListener("click", () => {
      location.href = "./dashboard.html";
    });
  }

  if (bottomRightBtn) {
    bottomRightBtn.addEventListener("click", () => {
      location.href = "./time-tracking.html";
    });
  }

  if (plusBtn) {
    plusBtn.addEventListener("click", () => {
      location.href = "./log-work.html";
    });
  }

  applyOverviewBanner();
  renderDonut();   // ✅ now by USER
  renderRecent();

  function applyOverviewBanner() {
    if (!overviewBox) return;
    const banner = currentGroup.bannerDataUrl || "";
    if (!banner) return;

    overviewBox.style.backgroundImage = `
      linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.78)),
      url("${banner}")
    `;
    overviewBox.style.backgroundSize = "cover";
    overviewBox.style.backgroundPosition = "center";
    overviewBox.style.backgroundRepeat = "no-repeat";
  }

  // ✅ Donut: one USER = one color
  function renderDonut() {
    if (!donutWrap) return;

    const logs = Array.isArray(currentGroup.workLogs) ? currentGroup.workLogs : [];
    if (!logs.length) {
      donutWrap.innerHTML = `<div class="donutEmptyRing"></div>`;
      return;
    }

    // group by memberId (fallback to memberName to avoid collapsing)
    const byUser = new Map();
    for (const log of logs) {
      const memberId = (log.memberId && String(log.memberId)) || "";
      const memberName = (log.memberName && String(log.memberName)) || "User";
      const key = memberId || ("name:" + memberName);

      if (!byUser.has(key)) {
        byUser.set(key, {
          id: memberId || key,
          name: memberName,
          minutes: 0
        });
      }
      byUser.get(key).minutes += Number(log.minutes || 0);
    }

    const segments = Array.from(byUser.values()).sort((a, b) => b.minutes - a.minutes);
    const total = segments.reduce((s, x) => s + x.minutes, 0) || 1;

    const colors = ["#F0D35B", "#66AEEF", "#F46D6D", "#8FD38F", "#B9A3FF", "#F5A25D"];

    let start = 0;
    const pieces = segments.map((seg, i) => {
      const ratio = seg.minutes / total;
      const end = start + ratio;
      const color = colors[i % colors.length];
      const piece = `${color} ${start * 360}deg ${end * 360}deg`;
      start = end;
      return piece;
    });

    donutWrap.innerHTML = `
      <div class="donutChart" style="background: conic-gradient(${pieces.join(", ")});">
        <div class="donutHole"></div>
      </div>
    `;
  }

  function renderRecent() {
    if (!recentList) return;

    const logs = Array.isArray(currentGroup.workLogs) ? [...currentGroup.workLogs] : [];
    logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!logs.length) {
      recentList.innerHTML = `<div class="recentEmpty">No activity yet</div>`;
      return;
    }

    recentList.innerHTML = "";
    logs.slice(0, 10).forEach((log) => {
      recentList.appendChild(createRecentRow(log));
    });
  }

  function createRecentRow(log) {
    const row = document.createElement("div");
    row.className = "recentItem";

    const memberName = log.memberName || "User";
    const avatarHtml = log.memberPhotoDataUrl
      ? `<img class="recentAvatarImg" src="${log.memberPhotoDataUrl}" alt="">`
      : `<div class="recentAvatar">${App.initials(memberName)}</div>`;

    const taskName = escapeHtml(log.taskName || "Task");
    const desc = escapeHtml(log.description || "");
    const stars = "★".repeat(Math.max(1, Math.min(5, Number(log.stars || 3))));
    const durationText = App.formatMinutes(Number(log.minutes || 0));
    const photoHtml = log.photoDataUrl
      ? `<img class="recentDetailPhoto" src="${log.photoDataUrl}" alt="work photo">`
      : "";

    row.innerHTML = `
      <div class="recentRowHead" role="button" tabindex="0" aria-expanded="false">
        <div class="recentLeft">
          ${avatarHtml}
          <div class="recentText">
            <div class="recentTask">${taskName}</div>
            <div class="recentMeta">${escapeHtml(memberName)}</div>
          </div>
        </div>
        <div class="recentRight">
          <div class="recentStars">${stars}</div>
          <div class="recentTime">${durationText}</div>
        </div>
      </div>
      <div class="recentRowBody" hidden>
        ${desc ? `<div class="recentDesc">${desc}</div>` : ""}
        ${photoHtml}
      </div>
    `;

    const head = row.querySelector(".recentRowHead");
    const body = row.querySelector(".recentRowBody");

    const toggle = () => {
      const expanded = head.getAttribute("aria-expanded") === "true";
      head.setAttribute("aria-expanded", String(!expanded));
      if (body) body.hidden = expanded;
    };

    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    return row;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();