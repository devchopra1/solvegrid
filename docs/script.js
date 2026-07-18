// Generate Widget Heatmap
const widgetHeatmapContainer = document.getElementById('widgetHeatmap');
if (widgetHeatmapContainer) {
    const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    
    months.forEach(month => {
        const monthBlock = document.createElement('div');
        monthBlock.className = 'month-block';
        
        const grid = document.createElement('div');
        grid.className = 'month-grid';
        
        for (let i = 0; i < 28; i++) {
            const cell = document.createElement('div');
            cell.className = 'widget-heat-cell';
            
            const rand = Math.random();
            if (rand > 0.95) cell.classList.add('active-high');
            else if (rand > 0.85) cell.classList.add('active-med');
            else if (rand > 0.75) cell.classList.add('active-low');
            
            grid.appendChild(cell);
        }
        
        const label = document.createElement('div');
        label.className = 'month-label';
        label.innerText = month;
        
        monthBlock.appendChild(grid);
        monthBlock.appendChild(label);
        widgetHeatmapContainer.appendChild(monthBlock);
    });
}

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Theme Toggle Logic
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    const htmlEl = document.documentElement;

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        htmlEl.setAttribute('data-theme', savedTheme);
        themeToggle.innerText = savedTheme === 'dark' ? '☀️' : '🌙';
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        htmlEl.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        themeToggle.innerText = newTheme === 'dark' ? '☀️' : '🌙';
    });
}
