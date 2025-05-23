# AlterPage

![icon16](https://github.com/user-attachments/assets/bea8396b-eea1-46ec-937c-e675dd482632)

![image](https://github.com/user-attachments/assets/7f2b85b9-89fe-4ba6-86f0-9669a47cd307)



A powerful browser extension that lets you inject and manage custom JavaScript scripts on any website, similar to Tampermonkey but with a streamlined interface.

---

## Features 

- **Easy Script Injection**: Quickly add scripts to modify web pages (perfect for testing)
- **URL Pattern Matching**: Scripts only run on specified websites (`@match`)
- **Dark/Light Mode**: Choose your preferred theme
- **Script Management**: Enable/disable, edit, and organize your scripts
- **Real-time Console**: See execution logs and errors
- **Syntax Highlighting**: Beautiful code editor with formatting
- **Auto-execution**: Scripts run automatically when matching pages load

---

## Installation

### Chrome / Edge / Brave

1. Download the `.zip` file from [Releases](../../releases)
2. Extract it to a folder
3. Go to `chrome://extensions`
4. Enable **Developer mode** (toggle in top right)
5. Click **Load unpacked** and select the extracted folder

### Firefox (working on getting it to work with FireFox) **coming soon**

1. Download the `.xpi` file from [Releases](../../releases)
2. Go to `about:addons`
3. Click the gear icon → **Install Add-on From File**
4. Select the downloaded `.xpi` file

---

## How to Use 🛠

### Creating a Script

1. Open the extension popup
2. Paste your code in the editor:
````javascript
// ==UserScript==
// @name Example Script
// @match ://.example.com/*
// ==/UserScript==

(function() {
'use strict';
// Your code here
console.log('Script running on example.com!');
})();
````


3. Click **Run & Save**

---

### Script Metadata

Use these special comments to configure your script:
````javascript
// ==UserScript==
// @name My Awesome Script
// @namespace http://your-namespace.com
// @version 1.0
// @description What this script does
// @author Your Name
// @match ://.example.com/*
// @match ://.test.com/path*
// ==/UserScript==
````

---

### Managing Scripts

- **Enable/Disable**: Toggle the switch on each script card
- **Edit**: Click the pencil icon to modify a script
- **Delete**: Click the trash icon to remove a script

---

## Advanced Usage

### URL Pattern Matching

The `@match` directive supports these patterns:

- `*://*.example.com/*` — All pages on example.com and its subdomains
- `https://example.com/specific/path` — Specific path only
- `*://example.com/*.html` — All HTML pages on example.com

---

### Keyboard Shortcuts (THESE ARE KINDA BROKEN ATM)

- `Ctrl+S` / `Cmd+S`: Save current script
- `Ctrl+Enter`: Run current script

---

## Troubleshooting

**Script isn't executing?**

- Check your `@match` patterns match the current URL
- Ensure the script is enabled (toggle is on)
- Look for errors in the extension console

**Getting permission errors?**

The extension needs these permissions:

- Access to page content (to inject scripts)
- Storage (to save your scripts)

---

## Contributing

Contributions welcome! Here's how:

1. Fork the repository
2. Create a feature branch  
git checkout -b feature/amazing-feature
3. Commit your changes  
git commit -m 'Add amazing feature'
4. Push to the branch  
git push origin feature/amazing-feature
5. Open a Pull Request

---

## Support

If you enjoy AlterPage, consider supporting its development:

- Donate via [PayPal](https://www.paypal.com/donate/?business=SC3RFTW5QDZJ4&no_recurring=0&currency_code=USD) <!-- Replace with your actual donation link -->

---

## License

MIT License — see [LICENSE.md](LICENSE.md) for details

---

Happy scripting! 🚀  
Let your browser do more with AlterPage.

````
AlterPage/
├── background.js
├── manifest.js
├── icon16.png
├── icon48.png
├── icon128.png
└── popup/
    ├── popup.css
    ├── popup.html
    └── popup.js
````
