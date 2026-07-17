# SolveGrid — User Guide

Welcome to **SolveGrid**! SolveGrid is a clean, native desktop widget designed to track and display your LeetCode progress directly on your desktop. This guide explains how to install, configure, and get the most out of your new widget.

---

## 🚀 Installation & Setup

1. **Run the Installer**: Double-click the generated `SolveGrid_x64-setup.exe` (Windows) or install the package for your system.
2. **First-Launch Setup**: 
   - When the widget opens for the first time, you will see a setup screen asking for your LeetCode username.
   - Enter your LeetCode username and press **Enter** (or click the checkmark).
   - *Note: Only public LeetCode profiles can be fetched. SolveGrid does not require your password or session tokens.*

---

## 📊 Feature Breakdown

### 1. Progress Overview
- **Total Solved**: Prominently displays the total number of problems you've solved out of the total available LeetCode problems (e.g., `98 / 3,991`).
- **Streak & Last Updated**: Displays your active daily streak and a timestamp indicating the last successful data synchronization.

### 2. Difficulty Progress Rings
- Located in the upper right, this visual ring display shows your progress relative to total available questions for each difficulty tier:
  - 🟢 **Outer Ring (Green)**: Easy progress.
  - 🟡 **Middle Ring (Yellow)**: Medium progress.
  - 🔴 **Inner Ring (Red)**: Hard progress.
- Hover over the rings to see precise solved counts per difficulty.

### 3. Submission Heatmap
- A GitHub-style contribution grid showcasing your LeetCode submissions over the **last 6 months**.
- **Interactive Cells**: Hover over any day block in the grid to highlight it.
- **Color Intensity**: The brightness of the green indicates your submission count for that day (from gray/no submissions to bright green/high activity).

---

## 🖱 Widget Controls & Customization

The widget integrates seamlessly with your desktop. Right-click anywhere on the widget to open the **Options Menu**:

| Action | Description |
| :--- | :--- |
| 🪟 **Change Size** | Switch the widget between **Small**, **Medium** (Default), or **Large** layouts. The widget scaling updates crispness automatically on high-DPI monitors. |
| 👤 **Change Username** | Switch the tracked profile to another LeetCode account. |
| 🔄 **Refresh Now** | Manually force an instant refresh of LeetCode statistics. |
| 🚀 **Auto-Start on Boot** | Toggle whether SolveGrid launches silently in the background when your computer starts. |
| ❌ **Exit** | Fully close the widget. |

---

## 🛠 Advanced Native Behaviors

- **Desktop Dragging**: Click and drag anywhere on the widget to move it. It remembers its position across reboots.
- **Sticky Desktop Window**: SolveGrid stays pinned to your desktop. It is configured to run behind other windows and will never pop up in front of active applications.
- **Auto-Sync Interval**: The widget updates itself automatically every **5 minutes** in the background, and triggers a quick refresh check whenever you return to your desktop.
- **Silent Start**: If configured to start on boot, it will launch silently (minimized to the system tray) without interrupting your work.
