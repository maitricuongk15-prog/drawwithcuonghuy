const APP_INFO = {
  name: "Draw With Cuong Huy",
  latest: {
    version: "1.0.0",
    size: "63.2 MB",
    updatedAt: "2026-02-28",
    apkUrl: "https://expo.dev/artifacts/eas/kRSsHbeVg8W59tRMKg1JqX.apk",
    changelog: [
      "Fixed production APK server fallback (avoid Candidates: N/A on phone)",
      "Improved login/register stability on Render cold start (longer timeout)",
      "Collaborative drawing with project rooms",
      "Invite-code based join flow",
      "Material icon tool bar and color panel",
      "PNG export and drawing stroke improvements"
    ]
  },
  history: [
    {
      version: "1.0.0",
      size: "63.2 MB",
      updatedAt: "2026-02-28",
      notes: "Hotfix build: fallback server URL for APK + timeout improvements",
      apkUrl: "https://expo.dev/artifacts/eas/kRSsHbeVg8W59tRMKg1JqX.apk"
    },
    {
      version: "1.0.0",
      size: "63.2 MB",
      updatedAt: "2026-02-28",
      notes: "Initial public APK build",
      apkUrl: "https://expo.dev/artifacts/eas/dSoaBSPiyTwbTPzWRX3keQ.apk"
    }
  ]
};

function renderLatest() {
  const { latest } = APP_INFO;
  const downloadBtn = document.getElementById("downloadBtn");
  const versionEl = document.getElementById("appVersion");
  const sizeEl = document.getElementById("appSize");
  const updatedEl = document.getElementById("updatedAt");
  const qrImage = document.getElementById("qrImage");
  const changelog = document.getElementById("changelog");

  if (downloadBtn) {
    downloadBtn.href = latest.apkUrl;
  }
  if (versionEl) {
    versionEl.textContent = latest.version;
  }
  if (sizeEl) {
    sizeEl.textContent = latest.size;
  }
  if (updatedEl) {
    updatedEl.textContent = latest.updatedAt;
  }
  if (qrImage) {
    const qrBase = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=";
    qrImage.src = `${qrBase}${encodeURIComponent(latest.apkUrl)}`;
  }
  if (changelog) {
    changelog.innerHTML = "";
    latest.changelog.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      changelog.appendChild(li);
    });
  }
}

function renderHistory() {
  const container = document.getElementById("versionList");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  APP_INFO.history.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "version-item";
    item.innerHTML = `
      <div class="version-main">
        <p class="version-title">v${entry.version}</p>
        <p class="version-meta">${entry.updatedAt} | ${entry.size} | ${entry.notes}</p>
      </div>
      <a class="version-link" href="${entry.apkUrl}" target="_blank" rel="noopener noreferrer">Download</a>
    `;
    container.appendChild(item);
  });
}

renderLatest();
renderHistory();
