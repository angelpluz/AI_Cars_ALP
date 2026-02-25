import type { RemoteProxyInfo } from './proxyClient';

type RagAdminPageConfig = {
  defaultDataset?: string;
  remoteInfo: Pick<RemoteProxyInfo, 'baseUrl'>;
  largeModel?: string;
};

const ADMIN_TEMPLATE = String.raw`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RAG Admin Console</title>
  <style>
    :root {
      --bg: #f5f6f8;
      --panel: #ffffff;
      --accent: #c8102e;
      --accent-dark: #9f0d24;
      --text: #12151a;
      --text-soft: #6b7280;
      --border: rgba(17, 24, 39, 0.12);
      --shadow: 0 24px 45px rgba(17, 24, 39, 0.12);
      --mono: 'IBM Plex Mono', 'Menlo', 'Consolas', monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: var(--bg); font-family: 'Inter', 'Segoe UI', sans-serif; color: var(--text); padding: 40px 20px;
    }
    .shell {
      width: 100%; max-width: 720px; background: var(--panel); border-radius: 24px; padding: 32px;
      border: 1px solid var(--border); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 24px;
    }
    .header { display: flex; flex-direction: column; gap: 8px; }
    .header h1 { margin: 0; font-size: 28px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
    .header p { margin: 0; color: var(--text-soft); }
    .info { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-soft); }
    form { display: grid; gap: 18px; }
    label { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--text-soft); }
    input[type='text'], input[type='url'], textarea {
      width: 100%; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--border);
      background: rgba(255,255,255,0.95); font-size: 14px; color: var(--text);
    }
    textarea { min-height: 160px; resize: vertical; font-family: var(--mono); }
    .actions { display: flex; justify-content: flex-end; gap: 12px; }
    button[type='submit']{
      background: linear-gradient(120deg, var(--accent), #ff3b51); color: #fff; border: none; border-radius: 16px;
      padding: 12px 22px; font-weight: 600; letter-spacing: 0.06em; cursor: pointer; transition: transform .2s, box-shadow .2s;
    }
    button[type='submit']:hover { transform: translateY(-2px); box-shadow: 0 16px 32px rgba(200,16,46,.35); }
    .status { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-soft); }
    .status.flash { color: var(--accent); }
    .hint { font-size: 12px; color: var(--text-soft); line-height: 1.5; }
    .grid { display: grid; gap: 14px; }
    .card {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 24px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.7);
    }
    .card h2 {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--accent-dark);
    }
    .checkboxRow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .checkboxLabel {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: var(--text-soft);
    }
    .checkboxLabel input {
      width: 18px;
      height: 18px;
    }
    .preview {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .tabBar {
      display: inline-flex;
      gap: 12px;
      align-items: center;
    }
    .tabButton {
      padding: 8px 16px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-soft);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }
    .tabButton.active {
      background: var(--accent);
      color: #fff;
      border-color: transparent;
      transform: translateY(-1px);
    }
    .tabButton.disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }
    .previewPanels {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .previewPanels .panel {
      display: none;
      flex-direction: column;
      gap: 10px;
    }
    .previewPanels .panel.active {
      display: flex;
    }
    #jsonPreviewClean,
    #jsonPreviewReview {
      min-height: 160px;
      max-height: 320px;
      resize: vertical;
      font-family: var(--mono);
    }
    .downloadLink {
      font-size: 13px;
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    @media (max-width: 640px) { .shell { padding: 24px; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="header">
      <h1>RAG Admin Console</h1>
      <p>Ingest new knowledge sources for your AI agent. Provide either a URL to fetch or paste raw notes.</p>
      <div class="info">
        Upsert Endpoint — <code>POST /api/rag/upsert</code>
        &nbsp;| Upstream — <code>{{UPSTREAM}}</code>
      </div>
    </header>

    <form id="ragAdminForm">
      <label>
        Dataset name
        <input type="text" id="datasetInput" placeholder="e.g. toyota-service-faq" value="{{DEFAULT_DATASET}}" />
      </label>

      <div class="grid">
        <label>
          Reference URL (optional)
          <input type="url" id="sourceUrlInput" placeholder="https://example.com/docs or https://api.example.com/items" />
        </label>
        <label>
          Raw notes (optional, used if URL is empty)
          <textarea id="rawTextInput" placeholder="Paste text snippets or FAQs here"></textarea>
        </label>
      </div>

      <div class="hint">
        Tip: Paste multiple paragraphs to batch-ingest content. JSON APIs are supported; if both URL and raw text are provided, raw text still takes priority.
      </div>

      <div class="actions">
        <button type="submit">Ingest Knowledge</button>
      </div>
    </form>

    <div class="status" id="adminStatus">Awaiting input.</div>

    <section class="card">
      <div>
        <h2>Fetch URL &amp; Clean</h2>
        <p class="hint">
          ใส่ลิงก์ต้นทาง แล้วให้ระบบดึงข้อมูลมาทำความสะอาด พร้อมตัวเลือก LLM review ในขั้นตอนเดียว.
        </p>
      </div>
      <form id="urlFetchForm">
        <label>
          Dataset name (optional)
          <input type="text" id="urlDatasetInput" placeholder="e.g. tpqi-qualifications" />
        </label>
        <label>
          Source URL
          <input type="url" id="urlFetchInput" placeholder="https://example.com/article" required />
        </label>
        <div class="checkboxRow">
          <label class="checkboxLabel">
            <input type="checkbox" id="urlReviewCheckbox" checked />
            <span>Run LLM review with model {{LARGE_MODEL}}</span>
          </label>
        </div>
        <div class="actions">
          <button type="submit">Fetch &amp; Clean</button>
        </div>
      </form>
      <div class="status" id="urlFetchStatus">Awaiting URL.</div>
    </section>

    <section class="card">
      <div>
        <h2>Upload JSON Dataset</h2>
        <p class="hint">
          เลือกไฟล์ JSON เพื่อทำความสะอาด ถอด artefact จากเว็บ และให้โมเดล {{LARGE_MODEL}} ทวนซ้ำให้อัตโนมัติ.
        </p>
      </div>
      <form id="jsonUploadForm" enctype="multipart/form-data">
        <label>
          Dataset name (optional)
          <input type="text" id="uploadDatasetInput" placeholder="e.g. provincial-labour-2566" />
        </label>
        <label>
          JSON file
          <input type="file" id="jsonFileInput" accept=".json,application/json" />
        </label>
        <div class="checkboxRow">
          <label class="checkboxLabel">
            <input type="checkbox" id="jsonReviewCheckbox" checked />
            <span>Run LLM review with model {{LARGE_MODEL}}</span>
          </label>
        </div>
        <div class="actions">
          <button type="submit">Upload &amp; Review</button>
        </div>
      </form>
      <div class="status" id="uploadStatus">Awaiting file.</div>
      <div class="preview">
        <div class="tabBar">
          <button type="button" class="tabButton active" data-preview-target="clean">Clean Only</button>
          <button type="button" class="tabButton" data-preview-target="review">LLM Reviewed</button>
        </div>
        <div class="previewPanels">
          <div class="panel active" data-preview-panel="clean">
            <label>
              Clean-only preview
              <textarea id="jsonPreviewClean" readonly placeholder="ผลลัพธ์ที่ทำความสะอาดแล้ว (แสดงบางส่วน)"></textarea>
            </label>
            <a id="jsonDownloadClean" class="downloadLink" download style="display:none;">Download clean JSON</a>
          </div>
          <div class="panel" data-preview-panel="review">
            <label>
              Reviewed preview
              <textarea id="jsonPreviewReview" readonly placeholder="ผลลัพธ์ที่ทำความสะอาดแล้ว (แสดงบางส่วน)"></textarea>
            </label>
            <a id="jsonDownloadReview" class="downloadLink" download style="display:none;">Download reviewed JSON</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <script>
    const form = document.getElementById('ragAdminForm');
    const datasetInput = document.getElementById('datasetInput');
    const sourceUrlInput = document.getElementById('sourceUrlInput');
    const rawTextInput = document.getElementById('rawTextInput');
    const statusEl = document.getElementById('adminStatus');
    const DEFAULT_DATASET = '{{DEFAULT_DATASET}}';
    const LARGE_MODEL = '{{LARGE_MODEL}}';

    const urlFetchForm = document.getElementById('urlFetchForm');
    const urlDatasetInput = document.getElementById('urlDatasetInput');
    const urlFetchInput = document.getElementById('urlFetchInput');
    const urlReviewCheckbox = document.getElementById('urlReviewCheckbox');
    const urlFetchStatus = document.getElementById('urlFetchStatus');

    const uploadForm = document.getElementById('jsonUploadForm');
    const uploadDatasetInput = document.getElementById('uploadDatasetInput');
    const jsonFileInput = document.getElementById('jsonFileInput');
    const reviewCheckbox = document.getElementById('jsonReviewCheckbox');
    const uploadStatus = document.getElementById('uploadStatus');
    const jsonPreviewClean = document.getElementById('jsonPreviewClean');
    const jsonPreviewReview = document.getElementById('jsonPreviewReview');
    const downloadCleanLink = document.getElementById('jsonDownloadClean');
    const downloadReviewLink = document.getElementById('jsonDownloadReview');
    const previewButtons = Array.from(document.querySelectorAll('[data-preview-target]'));
    const previewPanels = Array.from(document.querySelectorAll('[data-preview-panel]'));
    let cleanDownloadUrl = '';
    let reviewDownloadUrl = '';
    let activePreview = 'clean';

    if (datasetInput instanceof HTMLInputElement && DEFAULT_DATASET) {
      datasetInput.value = DEFAULT_DATASET;
    }
    if (urlDatasetInput instanceof HTMLInputElement && DEFAULT_DATASET) {
      urlDatasetInput.value = DEFAULT_DATASET;
    }

    function setStatus(message, flash) {
      if (!statusEl) return;
      statusEl.textContent = message;
      if (flash) {
        statusEl.classList.add('flash');
        setTimeout(() => statusEl.classList.remove('flash'), 1600);
      }
    }

    function setUploadStatus(message, flash) {
      if (!uploadStatus) return;
      uploadStatus.textContent = message;
      if (flash) {
        uploadStatus.classList.add('flash');
        setTimeout(() => uploadStatus.classList.remove('flash'), 1600);
      }
    }

    function setUrlStatus(message, flash) {
      if (!(urlFetchStatus instanceof HTMLElement)) return;
      urlFetchStatus.textContent = message;
      if (flash) {
        urlFetchStatus.classList.add('flash');
        setTimeout(() => urlFetchStatus.classList.remove('flash'), 1600);
      }
    }

    function resetDownloads() {
      if (cleanDownloadUrl) {
        URL.revokeObjectURL(cleanDownloadUrl);
        cleanDownloadUrl = '';
      }
      if (reviewDownloadUrl) {
        URL.revokeObjectURL(reviewDownloadUrl);
        reviewDownloadUrl = '';
      }
      if (downloadCleanLink instanceof HTMLAnchorElement) {
        downloadCleanLink.style.display = 'none';
        downloadCleanLink.removeAttribute('href');
      }
      if (downloadReviewLink instanceof HTMLAnchorElement) {
        downloadReviewLink.style.display = 'none';
        downloadReviewLink.removeAttribute('href');
      }
    }

    function formatPreview(text) {
      if (typeof text !== 'string' || !text) {
        return '';
      }
      return text.length > 4000 ? text.slice(0, 4000) + '\n...' : text;
    }

    function activatePreview(target) {
      const targetButton = previewButtons.find((button) => button instanceof HTMLButtonElement && button.dataset.previewTarget === target);
      if (!(targetButton instanceof HTMLButtonElement) || targetButton.disabled) {
        target = 'clean';
      }
      activePreview = target;
      previewButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const isActive = button.dataset.previewTarget === target && !button.disabled;
        button.classList.toggle('active', isActive);
      });
      previewPanels.forEach((panel) => {
        if (!(panel instanceof HTMLElement)) return;
        const isActive = panel.dataset.previewPanel === target;
        panel.classList.toggle('active', isActive);
      });
    }

    function setReviewAvailability(enabled) {
      previewButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        if (button.dataset.previewTarget === 'review') {
          button.disabled = !enabled;
          button.classList.toggle('disabled', !enabled);
        }
      });
      if (!enabled && activePreview === 'review') {
        activatePreview('clean');
      }
    }

    function applyCleaningResult(data, options) {
      const opts = options || {};
      const datasetName = typeof opts.datasetName === 'string' ? opts.datasetName.trim() : '';
      const reviewRequested = opts.reviewRequested !== false;
      const summary = data?.summary || {};
      const hasReviewed = typeof data?.reviewed === 'string' && data.reviewed.length > 0;

      if (jsonPreviewClean instanceof HTMLTextAreaElement && typeof data?.cleaned === 'string') {
        jsonPreviewClean.value = formatPreview(data.cleaned);
      }

      if (downloadCleanLink instanceof HTMLAnchorElement && typeof data?.cleaned === 'string') {
        const blob = new Blob([data.cleaned], { type: 'application/json' });
        cleanDownloadUrl = URL.createObjectURL(blob);
        downloadCleanLink.href = cleanDownloadUrl;
        const cleanName =
          typeof data.cleanedFilename === 'string' && data.cleanedFilename
            ? data.cleanedFilename
            : datasetName
            ? datasetName + '.clean-only.json'
            : 'dataset.clean-only.json';
        downloadCleanLink.download = cleanName;
        downloadCleanLink.style.display = 'inline-block';
      }

      if (jsonPreviewReview instanceof HTMLTextAreaElement) {
        if (hasReviewed && typeof data?.reviewed === 'string') {
          jsonPreviewReview.value = formatPreview(data.reviewed);
        } else if (reviewRequested) {
          jsonPreviewReview.value = 'No LLM review output was returned.';
        } else {
          jsonPreviewReview.value = 'LLM review was disabled for this run.';
        }
      }

      if (downloadReviewLink instanceof HTMLAnchorElement) {
        if (hasReviewed && typeof data?.reviewed === 'string') {
          const reviewBlob = new Blob([data.reviewed], { type: 'application/json' });
          reviewDownloadUrl = URL.createObjectURL(reviewBlob);
          downloadReviewLink.href = reviewDownloadUrl;
          const reviewName =
            typeof data.reviewedFilename === 'string' && data.reviewedFilename
              ? data.reviewedFilename
              : datasetName
              ? datasetName + '.reviewed.json'
              : 'dataset.reviewed.json';
          downloadReviewLink.download = reviewName;
          downloadReviewLink.style.display = 'inline-block';
        } else {
          downloadReviewLink.style.display = 'none';
          downloadReviewLink.removeAttribute('href');
        }
      }

      setReviewAvailability(hasReviewed);
      activatePreview(activePreview);

      const parts = [
        'Records: ' + (data?.recordCount ?? '?'),
        'Cookies removed: ' + (summary.removedCookieParagraphs ?? '?'),
        'Empty rows removed: ' + (summary.removedEmptyDataRows ?? '?'),
      ];
      if (data?.modelUsed) {
        parts.push('LLM review: ' + data.modelUsed);
      } else if (reviewRequested) {
        parts.push('LLM review: ' + (hasReviewed ? 'complete' : 'unavailable'));
      } else {
        parts.push('LLM review: disabled');
      }

      return { parts };
    }

    previewButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener('click', () => {
        if (button.disabled) return;
        activatePreview(button.dataset.previewTarget || 'clean');
      });
    });

    setReviewAvailability(false);
    activatePreview('clean');

    if (form instanceof HTMLFormElement) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const datasetName = datasetInput instanceof HTMLInputElement ? datasetInput.value.trim() : '';
        const sourceUrl = sourceUrlInput instanceof HTMLInputElement ? sourceUrlInput.value.trim() : '';
        const rawText = rawTextInput instanceof HTMLTextAreaElement ? rawTextInput.value.trim() : '';

        if (!datasetName) { setStatus('Dataset name is required.', true); return; }
        if (!sourceUrl && !rawText) { setStatus('Provide a source URL or raw notes.', true); return; }

        setStatus('Ingesting knowledge...', true);

        try {
          const payload = { datasetName, sourceUrl: sourceUrl || undefined, rawText: sourceUrl ? undefined : rawText };
          const response = await fetch('/api/rag/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.error || ('HTTP ' + response.status));
          const ingested = typeof data.ingested === 'number' ? data.ingested : 0;
          setStatus('Success: ingested ' + ingested + ' chunk(s).', true);
        } catch (error) {
          console.error(error);
          setStatus('Failed to ingest knowledge.', true);
        }
      });
    }

    if (urlFetchForm instanceof HTMLFormElement) {
      urlFetchForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const sourceUrl =
          urlFetchInput instanceof HTMLInputElement ? urlFetchInput.value.trim() : '';
        if (!sourceUrl) {
          setUrlStatus('Please enter a source URL.', true);
          return;
        }

        const datasetName =
          urlDatasetInput instanceof HTMLInputElement ? urlDatasetInput.value.trim() : '';
        const reviewRequested =
          urlReviewCheckbox instanceof HTMLInputElement ? Boolean(urlReviewCheckbox.checked) : true;

        setUrlStatus('Fetching & cleaning...', true);
        resetDownloads();
        setReviewAvailability(false);
        activatePreview('clean');
        if (jsonPreviewClean instanceof HTMLTextAreaElement) {
          jsonPreviewClean.value = '';
        }
        if (jsonPreviewReview instanceof HTMLTextAreaElement) {
          jsonPreviewReview.value = '';
        }

        try {
          const payload = {
            url: sourceUrl,
            dataset: datasetName || undefined,
            review: reviewRequested,
            model: reviewRequested && LARGE_MODEL ? LARGE_MODEL : undefined,
          };

          const response = await fetch('/api/rag/fetch-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok || !data.ok) {
            throw new Error(data.error || ('HTTP ' + response.status));
          }

          const resultMeta = applyCleaningResult(data, { datasetName, reviewRequested });
          setUrlStatus('Success - ' + resultMeta.parts.join(' | '), true);
        } catch (error) {
          console.error(error);
          setUrlStatus('Failed to fetch URL.', true);
        }
      });
    }

    if (uploadForm instanceof HTMLFormElement) {
      uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!(jsonFileInput instanceof HTMLInputElement) || !jsonFileInput.files || jsonFileInput.files.length === 0) {
          setUploadStatus('Select a JSON file first.', true);
          return;
        }

        const file = jsonFileInput.files[0];
        const datasetName =
          uploadDatasetInput instanceof HTMLInputElement ? uploadDatasetInput.value.trim() : '';
        const reviewRequested =
          reviewCheckbox instanceof HTMLInputElement ? Boolean(reviewCheckbox.checked) : true;

        setUploadStatus('Uploading & cleaning...', true);
        resetDownloads();
        setReviewAvailability(false);
        activatePreview('clean');
        if (jsonPreviewClean instanceof HTMLTextAreaElement) {
          jsonPreviewClean.value = '';
        }
        if (jsonPreviewReview instanceof HTMLTextAreaElement) {
          jsonPreviewReview.value = '';
        }

        try {
          const formData = new FormData();
          formData.append('file', file, file.name);
          if (datasetName) {
            formData.append('dataset', datasetName);
          }
          formData.append('review', reviewRequested ? 'true' : 'false');
          if (LARGE_MODEL) {
            formData.append('model', LARGE_MODEL);
          }

          const response = await fetch('/api/rag/upload-json', {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          if (!response.ok || !data.ok) {
            throw new Error(data.error || ('HTTP ' + response.status));
          }

          const resultMeta = applyCleaningResult(data, { datasetName, reviewRequested });
          setUploadStatus('Success - ' + resultMeta.parts.join(' | '), true);
        } catch (error) {
          console.error(error);
          setUploadStatus('Failed to process JSON upload.', true);
        }
      });
    }
  </script>
</body>
</html>
`;

function applyReplacements(html: string, entries: Array<[string, string]>): string {
  let output = html;
  for (const [token, value] of entries) {
    output = output.split(token).join(value);
  }
  return output;
}

export function renderRagAdminPage(config: RagAdminPageConfig): string {
  return applyReplacements(ADMIN_TEMPLATE, [
    ['{{DEFAULT_DATASET}}', config.defaultDataset ?? ''],
    ['{{UPSTREAM}}', config.remoteInfo.baseUrl],
    ['{{LARGE_MODEL}}', config.largeModel ?? 'gemma3:27b'],
  ]);
}
