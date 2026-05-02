const API_BASE_URL = '';

// ============================================================
// Initialization
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    fetchResults();
});

// ============================================================
// Fetch all result files from S3 via the backend
// ============================================================
async function fetchResults() {
    const loadingEl = document.getElementById('results-loading');
    const errorEl = document.getElementById('results-error');
    const emptyEl = document.getElementById('results-empty');
    const listEl = document.getElementById('results-list');

    // Reset visibility
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    listEl.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/results`);
        if (!response.ok) {
            throw new Error('Failed to fetch results');
        }

        const files = await response.json();

        loadingEl.classList.add('hidden');

        if (files.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }

        // Build result cards
        listEl.innerHTML = '';
        files.forEach(file => {
            const card = document.createElement('div');
            card.className = 'result-card';

            // Format the date nicely
            const date = new Date(file.last_modified);
            const dateStr = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });

            // Format file size
            const sizeStr = file.size < 1024
                ? `${file.size} B`
                : `${(file.size / 1024).toFixed(1)} KB`;

            card.innerHTML = `
                <div class="result-card-info">
                    <div class="result-card-icon">📄</div>
                    <div class="result-card-details">
                        <h3 class="result-card-name">${file.filename}</h3>
                        <p class="result-card-meta">${dateStr} · ${sizeStr}</p>
                    </div>
                </div>
                <div class="result-card-actions">
                    <button class="preview-btn" onclick="previewResult('${file.filename}')">
                        👁️ Preview
                    </button>
                    <a href="${API_BASE_URL}/results/download/${encodeURIComponent(file.filename)}" 
                       class="download-btn" download>
                        ⬇️ Download
                    </a>
                </div>
            `;
            listEl.appendChild(card);
        });

        listEl.classList.remove('hidden');

    } catch (error) {
        console.error('Error fetching results:', error);
        loadingEl.classList.add('hidden');
        document.getElementById('results-error-msg').textContent = `Failed to load results: ${error.message}`;
        errorEl.classList.remove('hidden');
    }
}

// ============================================================
// Preview a result file in a modal overlay
// ============================================================
async function previewResult(filename) {
    // Remove existing modal if any
    const existing = document.getElementById('preview-modal');
    if (existing) existing.remove();

    // Create the modal
    const modal = document.createElement('div');
    modal.id = 'preview-modal';
    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-modal-backdrop" onclick="closePreview()"></div>
        <div class="preview-modal-content">
            <div class="preview-modal-header">
                <h3>${filename}</h3>
                <button class="close-btn" onclick="closePreview()">&times;</button>
            </div>
            <div class="preview-modal-body">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading file content...</p>
                </div>
            </div>
            <div class="preview-modal-footer">
                <a href="${API_BASE_URL}/results/download/${encodeURIComponent(filename)}" 
                   class="download-btn" download>
                    ⬇️ Download File
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Fetch content
    try {
        const response = await fetch(`${API_BASE_URL}/results/download/${encodeURIComponent(filename)}`);
        if (!response.ok) throw new Error('Failed to load file');

        const text = await response.text();
        const bodyEl = modal.querySelector('.preview-modal-body');
        bodyEl.innerHTML = `<pre class="preview-text">${escapeHtml(text)}</pre>`;

    } catch (error) {
        const bodyEl = modal.querySelector('.preview-modal-body');
        bodyEl.innerHTML = `<p style="color:red; padding: 1rem;">Failed to load file: ${error.message}</p>`;
    }
}

function closePreview() {
    const modal = document.getElementById('preview-modal');
    if (modal) modal.remove();
}

// Utility: escape HTML to prevent XSS in preview
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
