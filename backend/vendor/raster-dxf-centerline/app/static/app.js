const form = document.getElementById("vectorize-form");
const fileInput = document.getElementById("file-input");
const simplificationInput = document.getElementById("simplification-input");
const statusNode = document.getElementById("status");
const previewShell = document.getElementById("preview-shell");
const pathCountNode = document.getElementById("path-count");
const dimensionsNode = document.getElementById("dimensions");
const downloadButton = document.getElementById("download-button");

let latestDxfBase64 = null;
const defaultApiBase =
  window.location.protocol === "file:" ? "http://127.0.0.1:8001" : "";
const apiBase =
  document.body?.dataset.apiBase?.replace(/\/$/, "") ||
  window.__VECTORIZE_API_BASE__?.replace(/\/$/, "") ||
  defaultApiBase;

function setStatus(kind, message) {
  statusNode.className = `status ${kind}`;
  statusNode.textContent = message;
}

function decodeBase64ToBlob(base64Text, contentType) {
  const byteCharacters = atob(base64Text);
  const byteNumbers = new Array(byteCharacters.length);

  for (let index = 0; index < byteCharacters.length; index += 1) {
    byteNumbers[index] = byteCharacters.charCodeAt(index);
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: contentType });
}

function downloadLatestDxf() {
  if (!latestDxfBase64) {
    return;
  }

  const blob = decodeBase64ToBlob(latestDxfBase64, "application/dxf");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vectorized.dxf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function vectorizeUrl(params) {
  const prefix = apiBase || "";
  return `${prefix}/vectorize?${params.toString()}`;
}

function networkErrorMessage(error) {
  if (!(error instanceof Error)) {
    return "Vectorization failed";
  }

  const offlineHint =
    'Could not reach the vectorization API. Open the app from "http://127.0.0.1:8001/" or keep the API running on port 8001.';

  if (window.location.protocol === "file:") {
    return offlineHint;
  }

  if (error instanceof TypeError) {
    return offlineHint;
  }

  return error.message;
}

downloadButton.addEventListener("click", downloadLatestDxf);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files?.[0];
  if (!file) {
    setStatus("error", "Choose an image before vectorizing.");
    return;
  }

  latestDxfBase64 = null;
  downloadButton.disabled = true;
  previewShell.classList.add("empty");
  previewShell.innerHTML = "<p>Tracing centerlines...</p>";
  setStatus("loading", "Vectorizing image...");

  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams({
    simplification: simplificationInput.value || "mid",
  });

  try {
    const response = await fetch(vectorizeUrl(params), {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "Vectorization failed");
    }

    latestDxfBase64 = payload.dxf_base64;
    downloadButton.disabled = false;
    pathCountNode.textContent = String(payload.path_count);
    dimensionsNode.textContent = `${payload.width} x ${payload.height}`;
    previewShell.classList.remove("empty");
    previewShell.innerHTML = payload.svg_preview;
    const preset = simplificationInput.value || "mid";
    setStatus("success", `Vectorization complete with ${preset} simplification. Review the preview and download the DXF.`);
  } catch (error) {
    previewShell.classList.add("empty");
    previewShell.innerHTML = "<p>Vectorization failed.</p>";
    pathCountNode.textContent = "-";
    dimensionsNode.textContent = "-";
    setStatus("error", networkErrorMessage(error));
  }
});
