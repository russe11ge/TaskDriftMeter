(async function () {
  const App = window.AppState;
  if (!App) return;

  const groupId = App.getCurrentGroupId();
  if (!groupId) {
    location.href = "./dashboard.html";
    return;
  }

  const $ = (sel) => document.querySelector(sel);

  const topLeftBtn = $("#topLeftBtn");
  const topRightBtn = $("#topRightBtn");
  const totalTimeValue = $("#totalTimeValue");
  const donutChart = $("#donutChart");
  const taskList = $("#taskList");

  const navGroupView = $("#navGroupView");
  const navDashboard = $("#navDashboard");
  const navTime = $("#navTime");

  const COLORS = ["#F0D35B", "#66AEEF", "#F46D6D", "#8FD38F", "#B9A3FF", "#F5A25D"];

  const { fbGetGroupById, fbToggleTaskComplete } = await import("./firebase-data.js");

  let group = await fbGetGroupById(groupId);
  if (!group) {
    location.href = "./dashboard.html";
    return;
  }

  init();

  function init() {
    if (topRightBtn) {
      App.applyTopRightAvatar(topRightBtn);
      topRightBtn.addEventListener("click", () => {
        location.href = "./profile.html";
      });
    }

    if (topLeftBtn) {
      topLeftBtn.addEventListener("click", () => {
        location.href = "./group-view.html";
      });
    }

    navGroupView?.addEventListener("click", () => location.href = "./group-view.html");
    navDashboard?.addEventListener("click", () => location.href = "./dashboard.html");
    navTime?.addEventListener("click", () => {});

    render();
  }

  function getMyLogs() {
    const user = App.loadUser();
    const logs = Array.isArray(group.workLogs) ? group.workLogs : [];
    return logs.filter(l => {
      const sameId = l.memberId && user.id && l.memberId === user.id;
      const sameEmail = l.memberEmail && user.email && l.memberEmail === user.email;
      return sameId || sameEmail;
    });
  }

  function getBreakdown(myLogs) {
    const byTask = new Map();
    for (const log of myLogs) {
      const key = log.taskId || log.taskName || "task";
      if (!byTask.has(key)) {
        byTask.set(key, { taskId: log.taskId || key, taskName: log.taskName || "Task", minutes: 0 });
      }
      byTask.get(key).minutes += Number(log.minutes || 0);
    }
    return Array.from(byTask.values()).sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
  }

  function render() {
    const myLogs = getMyLogs();
    const breakdown = getBreakdown(myLogs);
    const totalMinutes = breakdown.reduce((sum, x) => sum + Number(x.minutes || 0), 0);

    if (totalTimeValue) {
      totalTimeValue.textContent = App.formatMinutes(totalMinutes);
    }

    renderDonut(breakdown);
    renderTaskList(breakdown, totalMinutes);
  }

  function renderDonut(breakdown) {
    if (!donutChart) return;

    const total = breakdown.reduce((sum, x) => sum + Number(x.minutes || 0), 0);

    if (!total || breakdown.length === 0) {
      donutChart.style.background = "conic-gradient(#e5e5e5 0deg 360deg)";
      return;
    }

    let start = 0;
    const segments = breakdown.map((item, i) => {
      const ratio = (item.minutes || 0) / total;
      const end = start + ratio;
      const seg = `${COLORS[i % COLORS.length]} ${start * 360}deg ${end * 360}deg`;
      start = end;
      return seg;
    });

    donutChart.style.background = `conic-gradient(${segments.join(", ")})`;
  }

  function renderTaskList(breakdown, totalMinutes) {
    if (!taskList) return;

    if (!breakdown.length) {
      taskList.innerHTML = `<div class="emptyText">No logged work yet</div>`;
      return;
    }

    const completedSet = new Set(group.completedTaskIds || []);

    taskList.innerHTML = breakdown.map((item, i) => {
      const pct = totalMinutes > 0 ? Math.round((item.minutes / totalMinutes) * 100) : 0;
      const checked = completedSet.has(item.taskId);
      const color = COLORS[i % COLORS.length];

      return `
        <div class="taskRow" data-task-id="${escapeHtml(item.taskId)}">
          <div class="taskRowTop">
            <button class="taskCheck ${checked ? "checked" : ""}" aria-label="toggle complete"></button>
            <div class="taskName">${escapeHtml(item.taskName)}</div>
            <div class="taskTime">${escapeHtml(App.formatMinutes(item.minutes))}</div>
          </div>
          <div class="taskBarTrack">
            <div class="taskBarFill" style="width:${pct}%; background:${color};"></div>
          </div>
        </div>
      `;
    }).join("");

    taskList.querySelectorAll(".taskRow").forEach(row => {
      const taskId = row.getAttribute("data-task-id");
      const btn = row.querySelector(".taskCheck");
      btn?.addEventListener("click", async () => {
        try {
          await fbToggleTaskComplete(groupId, taskId);
          group = await fbGetGroupById(groupId);
          render();
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();