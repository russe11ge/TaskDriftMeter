(async function () {
  const groupsWrap = document.getElementById("groupsWrap");
  const btnProfile = document.getElementById("btnProfile");
  const btnCreate = document.getElementById("btnCreate");
  const btnJoin = document.getElementById("btnJoin");

  const tabGroup = document.getElementById("tabGroup");
  const tabTime = document.getElementById("tabTime");

  let myGroups = [];

  function renderTopRight() {
    AppState.applyTopRightAvatar(btnProfile);
  }

  function initials(name) {
    return AppState.initials(String(name || "G"));
  }

  function memberDotHTML(m) {
    const name = m?.username || m?.name || "Member";
    if (m?.photoDataUrl) {
      return `<div class="memberDot"><img src="${m.photoDataUrl}" alt=""></div>`;
    }
    return `<div class="memberDot">${initials(name)}</div>`;
  }

function renderGroups() {
  groupsWrap.innerHTML = "";

  if (!myGroups.length) {
    const empty = document.createElement("div");
    empty.className = "emptyMsg";
    empty.textContent = "No groups yet. Create or join one.";
    groupsWrap.appendChild(empty);
    return;
  }

  myGroups.forEach((g) => {
    const card = document.createElement("div");
    card.className = "groupCard";

    const members = Array.isArray(g.members) ? g.members : [];
    const shown = members.slice(0, 3);
    const extra = Math.max(0, members.length - shown.length);

    const memberHTML =
      shown.map(memberDotHTML).join("") +
      (extra > 0 ? `<div class="memberDot">+${extra}</div>` : "");

    const groupName = g.name || "Untitled Group";
    const code = g.code || "(no code)";

    card.innerHTML = `
      <button class="cardPin" type="button" title="Delete Group"></button>

      <div style="font-weight:900;font-size:16px;margin-bottom:6px;">
        ${groupName}
      </div>

      <div class="memberRow">${memberHTML}</div>

      <div class="cardMeta">
        Code: <b style="color:#111;">${code}</b> · ${members.length} members
      </div>
    `;

    // ✅ 卡片点击：进入 group
    card.addEventListener("click", () => {
      AppState.setCurrentGroupId(g.id);
      location.href = "./group-view.html";
    });

    // ✅ 叉点击：删除 group
    const pin = card.querySelector(".cardPin");
    pin.addEventListener("click", async (e) => {
      e.stopPropagation();

      const ok = confirm(`Delete group "${groupName}"?\nThis cannot be undone.`);
      if (!ok) return;

      try {
        const { fbDeleteGroup } = await import("./firebase-data.js");
        await fbDeleteGroup(g.id);

        if (AppState.getCurrentGroupId() === g.id) AppState.setCurrentGroupId("");

        myGroups = myGroups.filter(x => x.id !== g.id);
        renderGroups();
      } catch (err) {
        console.error(err);
        alert("Delete failed. Check Console.");
      }
    });

    groupsWrap.appendChild(card);
  });
}

  function ensureGroupThenGo(target) {
    const currentId = AppState.getCurrentGroupId();
    const current = myGroups.find((g) => g.id === currentId) || myGroups[0];
    if (!current) {
      alert("Please create or join a group first.");
      return;
    }
    AppState.setCurrentGroupId(current.id);
    location.href = target;
  }

  async function loadGroups() {
    const { fbGetMyGroups } = await import("./firebase-data.js");
    myGroups = await fbGetMyGroups();
  }

  function bindEvents() {
    btnProfile.onclick = () => (location.href = "./profile.html");
    btnCreate.onclick = () => (location.href = "./create-group.html");
    btnJoin.onclick = () => (location.href = "./join-group.html");

    tabGroup.onclick = () => ensureGroupThenGo("./group-view.html");
    tabTime.onclick = () => ensureGroupThenGo("./time-tracking.html");
  }

  try {
    bindEvents();
    renderTopRight();

    await loadGroups();
    renderGroups();
  } catch (err) {
    console.error("[dashboard.js] crash:", err);
    document.body.innerHTML = `
      <div style="padding:20px;color:#b00020;font-family:system-ui">
        Dashboard crashed. Open Console and send the red error.<br/>
        Dashboard 报错了，请把 Console 红字发我。
      </div>
    `;
  }
})();