const API_BASE_URL = '';

// ============================================================
// Initialization
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    fetchSymptoms();

    document.getElementById('close-result').addEventListener('click', () => {
        document.getElementById('result-section').classList.add('hidden');
    });

    // ----------------------------------------------------------
    // File upload area interactions
    // ----------------------------------------------------------
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    // Click to open file picker
    uploadArea.addEventListener('click', () => fileInput.click());

    // When a file is selected via the file picker
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            showSelectedFile(fileInput.files[0]);
        }
    });

    // Drag & drop support
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            showSelectedFile(e.dataTransfer.files[0]);
        }
    });
});

// ============================================================
// File upload helpers
// ============================================================
function showSelectedFile(file) {
    const nameEl = document.getElementById('selected-file-name');
    const uploadBtn = document.getElementById('upload-btn');

    // Reset previous status messages
    document.getElementById('upload-success').classList.add('hidden');
    document.getElementById('upload-error').classList.add('hidden');

    if (!file.name.endsWith('.txt')) {
        document.getElementById('upload-error-msg').textContent = '❌ Only .txt files are allowed.';
        document.getElementById('upload-error').classList.remove('hidden');
        uploadBtn.classList.add('hidden');
        return;
    }

    nameEl.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    nameEl.classList.remove('hidden');
    uploadBtn.classList.remove('hidden');
}

async function uploadFile() {
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const btnText = document.getElementById('upload-btn-text');
    const btnSpinner = document.getElementById('upload-spinner');
    const successEl = document.getElementById('upload-success');
    const errorEl = document.getElementById('upload-error');

    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a file first.');
        return;
    }

    const file = fileInput.files[0];

    // Show loading state
    btnText.textContent = 'Uploading...';
    btnSpinner.classList.remove('hidden');
    uploadBtn.disabled = true;
    successEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/upload-prompt`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Upload failed');
        }

        // Success!
        successEl.classList.remove('hidden');
        fileInput.value = '';
        document.getElementById('selected-file-name').classList.add('hidden');
        uploadBtn.classList.add('hidden');

    } catch (error) {
        console.error('Upload error:', error);
        document.getElementById('upload-error-msg').textContent = `❌ ${error.message}`;
        errorEl.classList.remove('hidden');
    } finally {
        btnText.textContent = 'Upload to S3';
        btnSpinner.classList.add('hidden');
        uploadBtn.disabled = false;
    }
}

// ============================================================
// Existing symptom fetching (unchanged)
// ============================================================
async function fetchSymptoms() {
    const loading = document.getElementById('loading');
    const errorMsg = document.getElementById('error-message');
    const symptomsGrid = document.getElementById('symptoms-grid');

    loading.classList.remove('hidden');
    errorMsg.classList.add('hidden');
    symptomsGrid.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/get-all`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        
        // Clear grid
        symptomsGrid.innerHTML = '';
        
        data.forEach(symptom => {
            const btn = document.createElement('button');
            btn.className = 'symptom-btn';
            btn.innerHTML = `
                <span>${symptom.symptom_name}</span>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            `;
            btn.onclick = () => fetchSymptomDetails(symptom.id, symptom.symptom_name);
            symptomsGrid.appendChild(btn);
        });

        loading.classList.add('hidden');
        symptomsGrid.classList.remove('hidden');

    } catch (error) {
        console.error('Error fetching symptoms:', error);
        loading.classList.add('hidden');
        errorMsg.classList.remove('hidden');
    }
}

async function fetchSymptomDetails(id, name) {
    const resultSection = document.getElementById('result-section');
    const resultLoading = document.getElementById('result-loading');
    const resultContent = document.getElementById('result-content');
    const resultTitle = document.getElementById('result-title');

    // Display section and loader
    resultSection.classList.remove('hidden');
    resultTitle.textContent = `${name}`;
    resultContent.classList.add('hidden');
    resultLoading.classList.remove('hidden');

    // Scroll smoothly to the result section
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const response = await fetch(`${API_BASE_URL}/get/${id}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        
        // Use marked.js to render Markdown format to HTML
        resultContent.innerHTML = marked.parse(data.output);
        
        resultLoading.classList.add('hidden');
        resultContent.classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching details:', error);
        resultLoading.classList.add('hidden');
        resultContent.innerHTML = '<p style="color: red; padding: 1rem 0;">Failed to load details. Please try again later.</p>';
        resultContent.classList.remove('hidden');
    }
}
