(function initializeClipperCore(global) {
  const DEFAULT_API_URLS = ["http://127.0.0.1:19827", "http://localhost:19827"];
  const MAX_EXTRACTED_CONTENT_CHARS = 1_000_000;
  const TRUNCATION_NOTICE = "\n\n[LLM Wiki Clipper: page content truncated at 1,000,000 characters.]";

  function limitExtractedContent(content) {
    const value = String(content || "");
    if (value.length <= MAX_EXTRACTED_CONTENT_CHARS) return value;
    return `${value.slice(0, MAX_EXTRACTED_CONTENT_CHARS)}${TRUNCATION_NOTICE}`;
  }

  function normalizeServerUrl(value) {
    let candidate = String(value || "").trim();
    if (!candidate) return DEFAULT_API_URLS[0];
    if (!/^https?:\/\//i.test(candidate)) candidate = `http://${candidate}`;
    const parsed = new URL(candidate);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error("Use an http(s) address without embedded credentials");
    }
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("Enter only the server origin, without a path, query, or fragment");
    }
    if (!parsed.port) parsed.port = "19827";
    return parsed.origin;
  }

  async function loadSettings() {
    const saved = await chrome.storage.local.get([
      "serverUrl",
      "accessToken",
      "preferredProjectPath",
    ]);
    let serverUrl;
    try {
      serverUrl = normalizeServerUrl(saved.serverUrl || DEFAULT_API_URLS[0]);
    } catch {
      serverUrl = DEFAULT_API_URLS[0];
    }
    return {
      serverUrl,
      accessToken: String(saved.accessToken || ""),
      preferredProjectPath: String(saved.preferredProjectPath || ""),
    };
  }

  function requestHeaders(accessToken, options) {
    const headers = new Headers(options?.headers || {});
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return headers;
  }

  async function clipFetch(path, options, connection) {
    const method = String(options?.method || "GET").toUpperCase();
    const serverUrl = normalizeServerUrl(connection?.serverUrl || DEFAULT_API_URLS[0]);
    // A POST is never retried because the first request may have reached the
    // Clip Server even when its response was lost.
    const isDefaultLocalAddress = DEFAULT_API_URLS.includes(serverUrl);
    const urls = method === "GET" && isDefaultLocalAddress
      ? [serverUrl, ...DEFAULT_API_URLS.filter((url) => url !== serverUrl)]
      : [serverUrl];
    let lastError;

    for (const baseUrl of urls) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers: requestHeaders(connection?.accessToken, options),
        });
        return { response, baseUrl };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Unable to connect to LLM Wiki");
  }

  // This function is serialized into the active tab by chrome.scripting, so it
  // must remain self-contained and must not capture extension-scope variables.
  function extractReadablePage() {
    try {
      const documentClone = document.cloneNode(true);
      const reader = new window.Readability(documentClone);
      const article = reader.parse();
      if (!article || !article.content) {
        return { error: "Readability could not extract content" };
      }

      const turndown = new window.TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-",
      });
      turndown.addRule("tableCell", {
        filter: ["th", "td"],
        replacement: (content) => ` ${content.trim()} |`,
      });
      turndown.addRule("tableRow", {
        filter: "tr",
        replacement: (content) => `|${content}\n`,
      });
      turndown.addRule("table", {
        filter: "table",
        replacement: (content) => {
          const lines = content.trim().split("\n");
          if (lines.length > 0) {
            const columns = (lines[0].match(/\|/g) || []).length - 1;
            lines.splice(1, 0, `|${" --- |".repeat(columns)}`);
          }
          return `\n\n${lines.join("\n")}\n\n`;
        },
      });
      turndown.addRule("removeSmallImages", {
        filter: (node) => {
          if (node.nodeName !== "IMG") return false;
          const width = parseInt(node.getAttribute("width") || "999");
          const height = parseInt(node.getAttribute("height") || "999");
          return width < 10 || height < 10;
        },
        replacement: () => "",
      });

      return {
        title: article.title || document.title || "Untitled",
        content: turndown.turndown(article.content),
        excerpt: article.excerpt || "",
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  function extractFallbackPage() {
    const clone = document.body?.cloneNode(true);
    if (!clone) return "";
    ["script", "style", "nav", "header", "footer", ".sidebar", ".ad", ".comments"]
      .forEach((selector) => clone.querySelectorAll(selector).forEach((element) => element.remove()));
    return clone.innerText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n\n");
  }

  async function extractActiveTab(commandTab) {
    // Chrome passes the exact shortcut target to commands.onCommand together
    // with the temporary activeTab grant. Popup callers do not have that value
    // and intentionally resolve their own currently active tab instead.
    const tab = commandTab?.id
      ? commandTab
      : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!tab?.id) throw new Error("No active browser tab");
    if (!/^https?:\/\//i.test(tab.url || "")) {
      throw new Error("This browser page cannot be clipped");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["Readability.js", "Turndown.js"],
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractReadablePage,
    });
    const extracted = results?.[0]?.result;
    let content = extracted?.content || "";
    if (!content) {
      const fallback = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFallbackPage,
      });
      content = fallback?.[0]?.result || "";
    }
    if (!content.trim()) throw new Error(extracted?.error || "Failed to extract page content");
    content = limitExtractedContent(content);

    return {
      title: extracted?.title || tab.title || "Untitled",
      url: tab.url || "",
      content,
      excerpt: extracted?.excerpt || "",
    };
  }

  async function loadProjects(connection) {
    const { response, baseUrl } = await clipFetch("/projects", { method: "GET" }, connection);
    if (response.status === 401) throw new Error("Access token required or invalid");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Failed to load projects");
    return { projects: data.projects || [], baseUrl };
  }

  function selectProject(projects, preferredProjectPath) {
    return projects.find((project) => project.path === preferredProjectPath)
      || projects.find((project) => project.current)
      || projects[0]
      || null;
  }

  async function submitClip(page, projectPath, connection) {
    const { response, baseUrl } = await clipFetch("/clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: page.title,
        url: page.url,
        content: page.content,
        projectPath,
      }),
    }, connection);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || `Clip failed: HTTP ${response.status}`);
    return { data, baseUrl };
  }

  global.LLMWikiClipper = Object.freeze({
    DEFAULT_API_URLS,
    MAX_EXTRACTED_CONTENT_CHARS,
    normalizeServerUrl,
    loadSettings,
    clipFetch,
    extractActiveTab,
    loadProjects,
    selectProject,
    submitClip,
  });
})(globalThis);
