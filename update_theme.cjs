const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'App.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Add CSS variables at the top
const cssVariables = `
:root {
  /* LIGHT MODE (Default) */
  --text-primary: #111317;
  --text-secondary: #6b7280;
  
  --widget-bg: radial-gradient(circle at 18% 5%, rgba(255, 255, 255, 0.4), transparent 32%),
               linear-gradient(145deg, rgba(255, 255, 255, 0.8) 0%, rgba(245, 245, 247, 0.85) 48%, rgba(235, 235, 240, 0.9) 100%);
  --widget-border: 1px solid rgba(0, 0, 0, 0.08);
  --widget-shadow: 0 24px 55px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  
  --stats-bg: rgba(0, 0, 0, 0.03);
  --stats-border: 1px solid rgba(0, 0, 0, 0.05);
  --stats-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.05);
  
  --cell-empty-bg: #e5e7eb;
  --cell-empty-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
  
  --menu-bg: rgba(245, 245, 247, 0.95);
  --menu-border: 1px solid rgba(0, 0, 0, 0.1);
  --menu-shadow: 0 18px 45px rgba(0, 0, 0, 0.2);
  --menu-item-hover: rgba(0, 0, 0, 0.05);
  --menu-divider: rgba(0, 0, 0, 0.08);
  
  --input-bg: rgba(0, 0, 0, 0.03);
  --input-border: 1px solid rgba(0, 0, 0, 0.1);
  --secondary-btn-bg: rgba(0, 0, 0, 0.05);
  --secondary-btn-text: #4b5563;
  --title-color: #168e49;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* DARK MODE */
    --text-primary: #f4f4f5;
    --text-secondary: #85858a;
    
    --widget-bg: radial-gradient(circle at 18% 5%, rgba(255, 255, 255, 0.045), transparent 32%),
                 linear-gradient(145deg, rgba(27, 27, 29, 0.985) 0%, rgba(14, 14, 16, 0.99) 48%, rgba(6, 6, 7, 0.995) 100%);
    --widget-border: 1px solid rgba(255, 255, 255, 0.14);
    --widget-shadow: 0 24px 55px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.055);
    
    --stats-bg: rgba(255, 255, 255, 0.03);
    --stats-border: 1px solid rgba(255, 255, 255, 0.05);
    --stats-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.15);
    
    --cell-empty-bg: #28282d;
    --cell-empty-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.018);
    
    --menu-bg: rgba(28, 28, 30, 0.98);
    --menu-border: 1px solid rgba(255, 255, 255, 0.11);
    --menu-shadow: 0 18px 45px rgba(0, 0, 0, 0.48);
    --menu-item-hover: rgba(255, 255, 255, 0.075);
    --menu-divider: rgba(255, 255, 255, 0.08);
    
    --input-bg: rgba(255, 255, 255, 0.055);
    --input-border: 1px solid rgba(255, 255, 255, 0.1);
    --secondary-btn-bg: rgba(255, 255, 255, 0.07);
    --secondary-btn-text: #d6d6d8;
    --title-color: #35df77;
  }
}
`;

// Insert the variables after resets
css = css.replace('/* ========================================\n   APP WINDOW\n======================================== */', cssVariables + '\n\n/* ========================================\n   APP WINDOW\n======================================== */');

// Replace body colors
css = css.replace('color: #f4f4f4;', 'color: var(--text-primary);');

// Replace widget backgrounds
css = css.replace(/border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.14\);/g, 'border: var(--widget-border);');
css = css.replace(/background:\s*radial-gradient[\s\S]*?100%\);/g, 'background: var(--widget-bg);');
css = css.replace(/box-shadow:\s*0 24px 55px rgba\(0,\s*0,\s*0,\s*0\.42\),[\s\S]*?0\.055\);/g, 'box-shadow: var(--widget-shadow);');

// Replace large-stats-column
css = css.replace(/background: rgba\(255, 255, 255, 0\.03\);/g, 'background: var(--stats-bg);');
css = css.replace(/border: 1px solid rgba\(255, 255, 255, 0\.05\);/g, 'border: var(--stats-border);');
css = css.replace(/box-shadow: inset 0 1px 1px rgba\(255, 255, 255, 0\.05\), 0 4px 12px rgba\(0, 0, 0, 0\.15\);/g, 'box-shadow: var(--stats-shadow);');

// Stats colors
css = css.replace(/color: rgba\(255, 255, 255, 0\.4\);/g, 'color: var(--text-secondary);');
css = css.replace(/color: #f4f4f5;(!important)?/g, 'color: var(--text-primary)$1;');

// Widget Title
css = css.replace(/color: #35df77;/g, 'color: var(--title-color);');

// Cell Empty Level 0
css = css.replace(/background: #28282d;/g, 'background: var(--cell-empty-bg);');
css = css.replace(/box-shadow:[\s]*inset 0 0 0 1px rgba\(255,[\s]*255,[\s]*255,[\s]*0\.018\);/g, 'box-shadow: var(--cell-empty-shadow);');

// Others text colors
css = css.replace(/color: #66666c;/g, 'color: var(--text-secondary);');
css = css.replace(/color: #77777d;/g, 'color: var(--text-secondary);');
css = css.replace(/color: #85858a;/g, 'color: var(--text-secondary);');
css = css.replace(/color: #f2f2f3;/g, 'color: var(--text-primary);');

// Context menu
css = css.replace(/background:[\s]*rgba\(28,[\s]*28,[\s]*30,[\s]*0\.98\);/g, 'background: var(--menu-bg);');
css = css.replace(/border:[\s]*1px solid rgba\(255,[\s]*255,[\s]*255,[\s]*0\.11\);/g, 'border: var(--menu-border);');
css = css.replace(/box-shadow:[\s]*0 18px 45px rgba\(0,[\s]*0,[\s]*0,[\s]*0\.48\);/g, 'box-shadow: var(--menu-shadow);');
css = css.replace(/color: #e7e7e9;/g, 'color: var(--text-primary);');
css = css.replace(/background:[\s]*rgba\(255,[\s]*255,[\s]*255,[\s]*0\.075\);/g, 'background: var(--menu-item-hover);');
css = css.replace(/background:[\s]*rgba\(255,[\s]*255,[\s]*255,[\s]*0\.08\);/g, 'background: var(--menu-divider);');

// Setup form
css = css.replace(/background:[\s]*rgba\(255,[\s]*255,[\s]*255,[\s]*0\.055\);/g, 'background: var(--input-bg);');
css = css.replace(/border:[\s]*1px solid rgba\(255,[\s]*255,[\s]*0\.1\);/g, 'border: var(--input-border);');
css = css.replace(/background:[\s]*rgba\(255,[\s]*255,[\s]*255,[\s]*0\.07\);/g, 'background: var(--secondary-btn-bg);');
css = css.replace(/color: #d6d6d8;/g, 'color: var(--secondary-btn-text);');
css = css.replace(/color: #f4f4f5 !important;/g, 'color: var(--text-primary) !important;');

fs.writeFileSync(cssPath, css);
console.log('App.css updated for Light/Dark mode.');
