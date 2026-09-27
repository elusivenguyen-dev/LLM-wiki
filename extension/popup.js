const clipperCore = globalThis.LLMWikiClipper;

const statusBar = document.getElementById("statusBar");
const titleInput = document.getElementById("titleInput");
const urlPreview = document.getElementById("urlPreview");
const contentPreview = document.getElementById("contentPreview");
const clipBtn = document.getElementById("clipBtn");
const projectSelect = document.getElementById("projectSelect");
const serverUrlInput = document.getElementById("serverUrlInput");
const accessTokenInput = document.getElementById("accessTokenInput");
const saveConnectionBtn = document.getElementById("saveConnectionBtn");
const connectionSettings = document.getElementById("connectionSettings");
const shortcutHint = document.getElementById("shortcutHint");

let extractedContent = "";
let pageUrl = "";
let apiUrl = clipperCore.DEFAULT_API_URLS[0];
let accessToken = "";

async function loadConnectionSettings() {
  const saved = await clipperCore.loadSettings();
  apiUrl = saved.serverUrl;
  accessToken = saved.accessToken;
  serverUrlInput.value = apiUrl;
  accessTokenInput.value = accessToken;
}

async function clipFetch(path, options) {
  const result = await clipperCore.clipFetch(path, options, {
    serverUrl: apiUrl,
    accessToken,
  });
  apiUrl = result.baseUrl;
  return result.response;
}

async function checkConnection() {
  let connectionError = "";
  try {
    const res = await clipFetch("/status", { method: "GET" });
    const data = await res.json();
    if (res.status === 401) throw new Error("Access token required or invalid");
    if (data.ok) {
      statusBar.className = "status connected";
      statusBar.textContent = "✓ Connected to LLM Wiki";
      await loadProjects();
      return true;
    }
  } catch (err) {
    connectionError = err?.message || "";
  }
  statusBar.className = "status disconnected";
  statusBar.textContent = connectionError.includes("token")
    ? "✗ Access token required or invalid"
    : "✗ Cannot connect to LLM Wiki"
  statusBar.title = connectionError;
  clipBtn.disabled = true;
  projectSelect.innerHTML = '<option value="">App not running</option>';
  return false;
}

async function loadProjects() {
  try {
    const res = await clipFetch("/projects", { method: "GET" });
    const data = await res.json();
    if (data.ok && data.projects?.length > 0) {
      const { preferredProjectPath } = await clipperCore.loadSettings();
      projectSelect.innerHTML = "";
      for (const proj of data.projects) {
        const opt = document.createElement("option");
        opt.value = proj.path;
        opt.textContent = proj.name + (proj.current ? " (current)" : "");
        if (proj.path === preferredProjectPath || (!preferredProjectPath && proj.current)) {
          opt.selected = true;
        }
        projectSelect.appendChild(opt);
      }
      if (!projectSelect.value && data.projects[0]) {
        projectSelect.value = data.projects[0].path;
      }
      return;
    }
  } catch {}
  // Fallback to current project
  try {
    const res = await clipFetch("/project", { method: "GET" });
    const data = await res.json();
    if (data.ok && data.path) {
      const name = data.path.replace(/\\/g, "/").split("/").pop() || data.path;
      projectSelect.innerHTML = `<option value="${data.path}">${name}</option>`;
    }
  } catch {
    projectSelect.innerHTML = '<option value="">No projects</option>';
  }
}

async function extractContent() {
  try {
    const page = await clipperCore.extractActiveTab();
    pageUrl = page.url;
    titleInput.value = page.title;
    urlPreview.textContent = pageUrl;
    extractedContent = page.content;
    contentPreview.textContent = page.excerpt
      ? `📝 ${page.excerpt}\n\n---\n\n${extractedContent}`
      : extractedContent;
    clipBtn.disabled = false;
  } catch (err) {
    contentPreview.textContent = `Error: ${err.message}`;
  }
}

async function sendClip() {
  const selectedProject = projectSelect.value;
  if (!selectedProject) {
    statusBar.className = "status error";
    statusBar.textContent = "✗ Please select a project";
    return;
  }

  clipBtn.disabled = true;
  statusBar.className = "status sending";
  statusBar.textContent = "⏳ Sending to LLM Wiki...";

  try {
    const result = await clipperCore.submitClip({
      title: titleInput.value,
      url: pageUrl,
      content: extractedContent,
    }, selectedProject, {
      serverUrl: apiUrl,
      accessToken,
    });
    apiUrl = result.baseUrl;
    await chrome.storage.local.set({
      serverUrl: apiUrl,
      preferredProjectPath: selectedProject,
    });
    const projectName = projectSelect.options[projectSelect.selectedIndex]?.textContent || "project";
    statusBar.className = "status success";
    statusBar.textContent = `✓ Saved to ${projectName}`;
    clipBtn.textContent = "✓ Clipped!";
  } catch (err) {
    statusBar.className = "status error";
    statusBar.textContent = `✗ Connection failed: ${err.message}`;
    clipBtn.disabled = false;
  }
}

clipBtn.addEventListener("click", sendClip);

projectSelect.addEventListener("change", () => {
  if (projectSelect.value) {
    void chrome.storage.local.set({ preferredProjectPath: projectSelect.value });
  }
});

saveConnectionBtn.addEventListener("click", async () => {
  try {
    const nextUrl = clipperCore.normalizeServerUrl(serverUrlInput.value);
    const originPattern = `${new URL(nextUrl).origin}/*`;
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) throw new Error("Host permission was not granted");
    apiUrl = nextUrl;
    accessToken = accessTokenInput.value.trim();
    await chrome.storage.local.set({ serverUrl: apiUrl, accessToken });
    connectionSettings.open = false;
    clipBtn.disabled = true;
    await checkConnection();
  } catch (err) {
    connectionSettings.open = true;
    statusBar.className = "status error";
    statusBar.textContent = `✗ ${err.message}`;
  }
});

// Resize content preview to fill available space without causing popup scroll
function resizePreview() {
  const totalHeight = 500; // matches html/body height
  const preview = document.getElementById("contentPreview");
  if (!preview) return;

  // Calculate space used by everything except the preview
  const previewRect = preview.getBoundingClientRect();
  const bottomSpace = totalHeight - previewRect.top - 60; // 60px for button + footer
  const maxH = Math.max(100, Math.min(300, bottomSpace));
  preview.style.maxHeight = maxH + "px";
}

(async () => {
  const commands = await chrome.commands.getAll();
  const clipCommand = commands.find((command) => command.name === "clip-current-page");
  shortcutHint.textContent = clipCommand?.shortcut
    ? `Shortcut: ${clipCommand.shortcut}`
    : "Set a shortcut at chrome://extensions/shortcuts";
  await loadConnectionSettings();
  const connected = await checkConnection();
  // Always extract content so user can preview, even if app not running
  await extractContent();
  if (!connected) {
    clipBtn.disabled = true;
    clipBtn.textContent = "📎 App not running — cannot save";
  }
  setTimeout(resizePreview, 100);
})();
