const API_BASE_URL = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {
    fetchSymptoms();

    document.getElementById('close-result').addEventListener('click', () => {
        document.getElementById('result-section').classList.add('hidden');
    });
});

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
