# SolveGrid

![SolveGrid Banner](https://img.shields.io/badge/SolveGrid-LeetCode%20Widget-3DF285?style=for-the-badge&logo=leetcode&logoColor=black)

**SolveGrid** is a beautiful, native desktop widget that brings your LeetCode progress right to your desktop. Built with a translucent glassmorphism design, it seamlessly blends into your workspace while keeping you motivated.

## ✨ Features

- **Live Progress Tracking**: Displays total solved problems and detailed Easy/Medium/Hard difficulty rings.
- **Contribution Heatmap**: Visualizes your last 6 months of LeetCode submissions with a GitHub-style heatmap.
- **Native Desktop Experience**: Frameless, draggable, and transparent window. It stays out of your way and docks naturally to your desktop wallpaper (Windows & Mac).
- **Multiple Sizes**: Right-click to switch between Small, Medium, and Large views.
- **Auto-Sync**: Silently fetches fresh data from LeetCode every 5 minutes and immediately upon window focus.
- **Crisp UI**: Built using dynamic resolution scaling for razor-sharp rendering on high-DPI displays at any size.

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Vanilla CSS
- **Backend / Desktop Integration**: [Tauri v2](https://v2.tauri.app/) (Rust)
- **Data Source**: LeetCode public GraphQL API (No authentication required)

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- Visual Studio C++ Build Tools (Windows) or Xcode Command Line Tools (Mac)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/devchopra1/solvegrid.git
   cd solvegrid
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```
   *Note: Upon first launch, right-click the empty widget, select "Change Username", and enter your LeetCode handle.*

## 📦 Building for Production

To create a standalone executable/installer for your operating system:

```bash
npm run tauri build
```

Once the compilation finishes (it may take a few minutes to heavily optimize the Rust binaries), the installer will be available in:
- **Windows**: `src-tauri/target/release/bundle/msi/` or `/nsis/`
- **Mac**: `src-tauri/target/release/bundle/dmg/` or `/app/`

## 🔒 Security & Privacy
SolveGrid is designed with a strict "least-privilege" security model. 
- **No Passwords**: It only reads public profiles via the official LeetCode GraphQL endpoint.
- **No Data Collection**: Your username and widget size preferences are stored entirely locally on your machine.
- **Locked-Down Container**: The frontend has zero access to your file system or command line.

---
*Built with ❤️ for the LeetCode community.*
