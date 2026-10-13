const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("icodeshell", {
  selectWorkspace: () => ipcRenderer.invoke("icode:select-workspace"),
  saveCode: (input) => ipcRenderer.invoke("icode:save-code", input),
  openNotepad: () => ipcRenderer.invoke("icode:open-notepad"),
});
