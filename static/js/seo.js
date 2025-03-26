document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const urlInput = document.getElementById('url-input');
    const scoreElement = document.querySelector('.score');
    const metaResult = document.getElementById('meta-result');
    const headingsResult = document.getElementById('headings-result');
    const keywordsResult = document.getElementById('keywords-result');
    const urlResult = document.getElementById('url-result');

    analyzeBtn.addEventListener('click', analyzeSEO);

    function analyzeSEO() {
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Please enter a URL to analyze');
            return;
        }

        // Simulate analysis (in a real app, this would be API calls)
        simulateAnalysis(url);
    }

    function simulateAnalysis(url) {
        // Show loading state
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        
        // Simulate network delay
        setTimeout(() => {
            // Generate random scores for demo purposes
            const metaScore = Math.floor(Math.random() * 20) + 80;
            const headingsScore = Math.floor(Math.random() * 20) + 70;
            const keywordsScore = Math.floor(Math.random() * 20) + 60;
            const urlScore = Math.floor(Math.random() * 20) + 90;
            
            const overallScore = Math.round((metaScore + headingsScore + keywordsScore + urlScore) / 4);
            
            // Update UI with results
            scoreElement.textContent = overallScore;
            scoreElement.style.color = getScoreColor(overallScore);
            
            metaResult.innerHTML = generateResultHTML('Meta Tags', metaScore, [
                '✔ Title tag present and optimized',
                '✔ Meta description present',
                '✖ Missing viewport meta tag'
            ]);
            
            headingsResult.innerHTML = generateResultHTML('Headings', headingsScore, [
                '✔ H1 tag present',
                '✔ Heading hierarchy maintained',
                '✖ Multiple H1 tags detected'
            ]);
            
            keywordsResult.innerHTML = generateResultHTML('Keywords', keywordsScore, [
                '✔ Primary keyword in title',
                '✔ Good keyword density (3.2%)',
                '✖ Keyword stuffing detected in some sections'
            ]);
            
            urlResult.innerHTML = generateResultHTML('URL Structure', urlScore, [
                '✔ URL contains primary keyword',
                '✔ URL is short and readable',
                '✖ Uppercase letters in URL'
            ]);
            
            // Reset button
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze';
        }, 1500);
    }

    function generateResultHTML(title, score, items) {
        let html = `<div class="result-score">${score}/100</div>`;
        html += '<ul class="result-items">';
        items.forEach(item => {
            html += `<li>${item}</li>`;
        });
        html += '</ul>';
        return html;
    }

    function getScoreColor(score) {
        if (score >= 80) return '#4cc9f0'; // Good
        if (score >= 60) return '#4895ef'; // Average
        return '#f72585'; // Poor
    }
});
