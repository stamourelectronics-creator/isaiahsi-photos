const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const appRoot = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const port = 8000;
const appOrigin = `http://localhost:${port}`;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};
const servedFiles = new Set([
  "app.js",
  "config.js",
  "icode.css",
  "icode.html",
  "icode.js",
  "index.html",
  "styles.css",
]);
let mainWindow;
let server;
let workspacePath = "";

function serveApp() {
  server = http.createServer((request, response) => {
    if (request.headers.host !== `localhost:${port}`) {
      response.writeHead(403).end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, appOrigin).pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (pathname === "/") pathname = "/index.html";
    if (!servedFiles.has(pathname.slice(1))) {
      response.writeHead(404).end();
      return;
    }
    const filePath = path.resolve(appRoot, `.${pathname}`);
    if (!filePath.startsWith(`${appRoot}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}

function trustedSender(event) {
  try {
    return event.senderFrame === event.sender.mainFrame && new URL(event.senderFrame.url).origin === appOrigin;
  } catch {
    return false;
  }
}

function requireTrustedSender(event) {
  if (!trustedSender(event)) throw new Error("Untrusted app request.");
}

ipcMain.handle("icode:select-workspace", async (event) => {
  requireTrustedSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose an ICode project folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return { cancelled: true };
  workspacePath = await fs.promises.realpath(result.filePaths[0]);
  return { name: path.basename(workspacePath) };
});

ipcMain.handle("icode:save-code", async (event, input) => {
  requireTrustedSender(event);
  if (!workspacePath) return { error: "Choose a project folder first." };
  if (!input || typeof input.filename !== "string" || !/^[\w.-]+\.html$/i.test(input.filename) || input.filename === ".html")
    return { error: "Use a simple HTML filename, such as index.html." };
  if (typeof input.content !== "string" || Buffer.byteLength(input.content, "utf8") > 1_500_000)
    return { error: "The generated file is empty or exceeds the 1.5 MB limit." };

  const target = path.join(workspacePath, input.filename);
  let existing;
  try {
    existing = await fs.promises.lstat(target);
  } catch (error) {
    if (error.code !== "ENOENT") return { error: "Could not inspect the target file." };
  }
  if (existing?.isSymbolicLink() || (existing && !existing.isFile()))
    return { error: "The target must be a regular file, not a link or folder." };
  const answer = await dialog.showMessageBox(mainWindow, {
    type: existing ? "warning" : "info",
    title: existing ? "Replace existing file?" : "Save generated file?",
    message: `${existing ? "Replace" : "Save"} ${input.filename} in the selected project folder?`,
    detail: path.basename(workspacePath),
    buttons: ["Cancel", existing ? "Replace file" : "Save file"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (answer.response !== 1) return { cancelled: true };
  try {
    const latest = await fs.promises.lstat(target).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (latest?.isSymbolicLink() || (latest && !latest.isFile()))
      return { error: "The target changed and is no longer a regular file." };
    if (!existing && latest) return { error: "A file with that name appeared; review the save again." };
    const temporary = path.join(workspacePath, `.icode-${randomUUID()}.tmp`);
    try {
      await fs.promises.writeFile(temporary, input.content, { encoding: "utf8", flag: "wx" });
      await fs.promises.rename(temporary, target);
    } catch (error) {
      await fs.promises.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
    return { saved: true };
  } catch {
    return { error: "Could not save the file in the selected project folder." };
  }
});

ipcMain.handle("icode:open-notepad", async (event) => {
  requireTrustedSender(event);
  if (process.platform !== "win32") return { error: "Notepad is available in the Windows app." };
  const answer = await dialog.showMessageBox(mainWindow, {
    type: "question",
    title: "Open Notepad?",
    message: "Isaiahsi ICode is asking to open Notepad on this computer.",
    buttons: ["Cancel", "Open Notepad"],
    defaultId: 0,
    cancelId: 0,
  });
  if (answer.response !== 1) return { cancelled: true };
  return new Promise((resolve) => {
    const child = spawn("notepad.exe", [], { detached: true, stdio: "ignore", shell: false });
    child.once("error", () => resolve({ error: "Windows could not open Notepad." }));
    child.once("spawn", () => {
      child.unref();
      resolve({ opened: true });
    });
  });
});

async function createWindow() {
  await serveApp();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 840,
    minHeight: 640,
    title: "Isaiahsi Photos",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === "https:") shell.openExternal(url);
    } catch {}
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== `${appOrigin}/` && !url.startsWith(`${appOrigin}/`)) {
      event.preventDefault();
      try {
        if (new URL(url).protocol === "https:") shell.openExternal(url);
      } catch {}
    }
  });
  await mainWindow.loadURL(appOrigin);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow).catch((error) => {
  dialog.showErrorBox("Isaiahsi Photos", `The desktop app could not start: ${error.message}`);
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  server?.close();
});
