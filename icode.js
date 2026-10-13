(() => {
  const promptInput = document.querySelector("#icode-prompt");
  const codeInput = document.querySelector("#icode-code");
  const filenameInput = document.querySelector("#icode-filename");
  const preview = document.querySelector("#icode-preview");
  const status = document.querySelector("#icode-status");
  const generateButton = document.querySelector("#icode-generate");
  const saveButton = document.querySelector("#icode-save");
  const workspaceButton = document.querySelector("#icode-workspace");
  const notepadRequest = document.querySelector("#icode-notepad");
  let workspaceName = "";

  function setStatus(message) {
    status.textContent = message;
  }

  function responseText(result) {
    const content = result?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content))
      return content.map((part) => part.text || "").join("\n");
    return result?.text || "";
  }

  function extractHtml(response) {
    const match = response.match(/```(?:html)?\s*([\s\S]*?)```/i);
    const documentText = (match ? match[1] : response).trim();
    if (!/<(?:!doctype\s+html|html|body|canvas)\b/i.test(documentText))
      throw new Error("The model did not return an HTML document. Try a more specific prompt.");
    return documentText;
  }

  function previewHtml(source) {
    const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\' data:; img-src data: blob:; media-src data: blob:; font-src data:; connect-src \'none\'; object-src \'none\'; frame-src \'none\'">';
    const head = /<head\b[^>]*>/i;
    preview.srcdoc = head.test(source)
      ? source.replace(head, (opening) => `${opening}${policy}`)
      : `<!doctype html><html><head>${policy}<meta charset="utf-8"></head><body>${source}</body></html>`;
  }

  function isNotepadRequest(text) {
    return /\b(open|launch|start)\b.{0,40}\bnotepad\b/i.test(text);
  }

  promptInput.addEventListener("input", () => {
    notepadRequest.hidden = !isNotepadRequest(promptInput.value);
  });

  generateButton.addEventListener("click", async () => {
    const request = promptInput.value.trim();
    if (!request) {
      setStatus("Describe the page or game you want to build first.");
      return;
    }
    if (isNotepadRequest(request)) {
      notepadRequest.hidden = false;
      setStatus("This local action needs your approval below.");
      return;
    }
    if (!window.puter?.ai) {
      setStatus("Puter AI did not load. Check your connection and reload.");
      return;
    }

    generateButton.disabled = true;
    saveButton.disabled = true;
    setStatus("Generating a standalone HTML project…");
    try {
      const result = await puter.ai.chat(
        `You are Isaiahsi ICode, a careful programming agent. Create a polished, complete, responsive standalone HTML experience for this request: ${request}\nReturn only the complete HTML document, with inline CSS and JavaScript. Make interactions genuinely work, handle errors, and avoid external dependencies, external network requests, and placeholder sections. Never claim you saved files or ran the code.`,
        { model: "claude-sonnet-4" },
      );
      const html = extractHtml(responseText(result));
      codeInput.value = html;
      previewHtml(html);
      saveButton.disabled = false;
      document.querySelector("#icode-refresh").disabled = false;
      setStatus("Review the generated code and sandboxed preview before saving.");
    } catch (error) {
      setStatus(error.message || "Code generation failed. Please try again.");
    } finally {
      generateButton.disabled = false;
    }
  });

  document.querySelector("#icode-refresh").addEventListener("click", () => {
    if (codeInput.value) previewHtml(codeInput.value);
  });

  workspaceButton.addEventListener("click", async () => {
    if (!window.icodeshell?.selectWorkspace) {
      setStatus("Choose project folder is available in the Windows desktop app.");
      return;
    }
    const result = await window.icodeshell.selectWorkspace();
    if (result?.name) {
      workspaceName = result.name;
      workspaceButton.textContent = `Project: ${workspaceName}`;
      setStatus("Generated files can be saved only in this selected folder.");
    }
  });

  saveButton.addEventListener("click", async () => {
    if (!codeInput.value) return;
    const filename = filenameInput.value.trim();
    if (!/^[\w.-]+\.html$/i.test(filename) || filename === ".html") {
      setStatus("Use a simple HTML filename, such as index.html.");
      return;
    }
    if (window.icodeshell?.saveCode) {
      const result = await window.icodeshell.saveCode({ filename, content: codeInput.value });
      if (result?.saved) setStatus(`Saved ${filename} in ${workspaceName || "your selected folder"}.`);
      else if (!result?.cancelled) setStatus(result?.error || "The file was not saved.");
      return;
    }
    const file = new Blob([codeInput.value], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus(`Downloaded ${filename}.`);
  });

  document.querySelector("#icode-open-notepad").addEventListener("click", async () => {
    if (!window.icodeshell?.openNotepad) {
      setStatus("Opening Notepad is available in the Windows desktop app.");
      return;
    }
    const result = await window.icodeshell.openNotepad();
    setStatus(result?.opened ? "Notepad opened." : result?.error || "Notepad could not be opened.");
  });
})();
