(async function () {
  const btnBack = document.getElementById("btnBack");
  const btnProfile = document.getElementById("btnProfile");
  const groupCode = document.getElementById("groupCode");
  const displayName = document.getElementById("displayName");
  const btnJoinGroup = document.getElementById("btnJoinGroup");
  const msg = document.getElementById("msg");

  function renderTopRight() {
    AppState.applyTopRightAvatar(btnProfile);
  }

  btnBack.onclick = () => (location.href = "./dashboard.html");
  btnProfile.onclick = () => (location.href = "./profile.html");

  btnJoinGroup.onclick = async () => {
    msg.textContent = "";
    const code = groupCode.value.trim().toUpperCase();
    const name = displayName.value.trim();

    if (!code) {
      msg.textContent = "Please enter group code.";
      return;
    }

    btnJoinGroup.disabled = true;
    btnJoinGroup.style.opacity = "0.7";

    try {
      const { fbJoinGroup } = await import("./firebase-data.js");
      const g = await fbJoinGroup({ code, displayName: name });

      AppState.setCurrentGroupId(g.id);
      location.href = "./dashboard.html";
    } catch (err) {
      console.error(err);
      msg.textContent = "Join failed. Check group code (or Firebase permissions).";
    } finally {
      btnJoinGroup.disabled = false;
      btnJoinGroup.style.opacity = "1";
    }
  };

  renderTopRight();
})();