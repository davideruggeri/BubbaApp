const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const ASSETS_DIR = path.join(__dirname, '../assets');
const ICON_SOURCE = path.join(ASSETS_DIR, 'logoBianco.jpeg');
const ICON_DEST = path.join(DIST_DIR, 'icon.jpeg');
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

// 1. Copy Icon
console.log('Copying icon...');
if (fs.existsSync(ICON_SOURCE)) {
    fs.copyFileSync(ICON_SOURCE, ICON_DEST);
    console.log('Icon copied to dist/icon.jpeg');
} else {
    console.error('Error: Source icon not found at', ICON_SOURCE);
    process.exit(1);
}

// 2. Generate Manifest
console.log('Generating manifest.json...');
const manifest = {
    "short_name": "BubbaApp",
    "name": "BubbaApp",
    "icons": [
        {
            "src": "icon.jpeg",
            "sizes": "192x192",
            "type": "image/jpeg"
        },
        {
            "src": "icon.jpeg",
            "sizes": "512x512",
            "type": "image/jpeg"
        }
    ],
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#ffffff",
    "background_color": "#ffffff"
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log('manifest.json created');

// 3. Inject into index.html
console.log('Injecting tags into index.html...');
let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

// Remove existing manifest/icon links if any to avoid duplicates
html = html.replace(/<link rel="manifest".*?>/g, '');
html = html.replace(/<link rel="apple-touch-icon".*?>/g, '');
html = html.replace(/<link rel="icon".*?>/g, '');

// Inject new tags
const tagsToInject = `
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icon.jpeg">
<link rel="icon" href="/icon.jpeg">
<meta name="theme-color" content="#ffffff">
`;

// Inject before </head>
html = html.replace('</head>', `${tagsToInject}</head>`);

fs.writeFileSync(INDEX_HTML_PATH, html);
console.log('index.html updated');

console.log('PWA injection complete!');
