importScripts("clipper-core.js");

const COMMAND_NAME = "clip-current-page";
let badgeTimer;
let clipInFlight = false;

async function setBadge(text, color, title, clearAfterMs = 0) {
  clearTimeout(badgeTimer);
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  if (title) await chrome.action.setTitle({ title });
  if (clearAfterMs > 0) {
    badgeTimer = setTimeout(() => {
      void chrome.action.setBadgeText({ text: "" });
      void chrome.action.setTitle({ title: "LLM Wiki Clipper" });
    }, clearAfterMs);
  }
}

async function clipCurrentPage(commandTab) {
  if (clipInFlight) {
    await setBadge("…", "#4f46e5", "A page clip is already in progress");
    return;
  }
  clipInFlight = true;
  const core = globalThis.LLMWikiClipper;
  try {
    await setBadge("…", "#4f46e5", "Clipping current page...");
    const settings = await core.loadSettings();
    const connection = {
      serverUrl: settings.serverUrl,
      accessToken: settings.accessToken,
    };
    const { projects, baseUrl } = await core.loadProjects(connection);
    connection.serverUrl = baseUrl;
    const project = core.selectProject(projects, settings.preferredProjectPath);
    if (!project) throw new Error("No LLM Wiki project is available");

    const page = await core.extractActiveTab(commandTab);
    const submitted = await core.submitClip(page, project.path, connection);
    await chrome.storage.local.set({
      serverUrl: submitted.baseUrl,
    });
    await setBadge("✓", "#059669", `Saved to ${project.name || "LLM Wiki"}`, 4000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[LLM Wiki Clipper] shortcut failed:", error);
    await setBadge("!", "#dc2626", `Clip failed: ${message}`, 7000);
  } finally {
    clipInFlight = false;
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === COMMAND_NAME) void clipCurrentPage(tab);
});
