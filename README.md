# 🗜️ Imress - Image Compressor

<p align="center">
  <img src="static/images/logo.png" alt="Imress Logo" width="400"/>
</p>

<p align="center">
  <b>A fast, lightweight, and professional desktop image compression tool — built with Python & Flask.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge&logo=python"/>
  <img src="https://img.shields.io/badge/Flask-3.0-black?style=for-the-badge&logo=flask"/>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge"/>
</p>

---

## 📌 About

**Imress** is a desktop image compression application that allows users to compress multiple images at once — quickly, efficiently, and without losing significant quality. Built with Python (Flask + Pillow) on the backend and HTML/CSS/JS on the frontend, wrapped into a native desktop window using PyWebView.

No internet connection required. No image uploads to any server. Everything runs **locally on your machine**.

---

## ✨ Features

- 📁 **Multiple Image Upload** — Select and compress multiple images at once
- 🖱️ **Drag & Drop Support** — Simply drag images into the upload area
- 📊 **Live Status Table** — Real-time status updates (Pending → Compressing → Complete)
- 🗂️ **Session Persistence** — Previously uploaded images stay visible when new ones are added (within the same session)
- 📥 **Individual Download** — Download each compressed image separately
- 📦 **ZIP Download** — Download all compressed images in one ZIP file
- 🏷️ **Original Filename Preserved** — Compressed files keep their original names
- 🖼️ **Original Format Preserved** — JPG stays JPG, PNG stays PNG, WEBP stays WEBP
- 📉 **Compression Stats** — See original size, optimized size, and percentage saved per image
- 🎯 **Summary Banner** — Overall compression percentage, total files optimized, total space saved
- 🎨 **Polished UI** — Smooth animations, hover effects, loading spinner, responsive design
- 🖥️ **Native Desktop App** — Runs as a standalone Windows desktop application (no browser needed)
- 📦 **Windows Installer** — Professional Setup Wizard with desktop shortcut and Start Menu entry

---

## 🖼️ Screenshots

> Main Interface

![Main UI](static/images/logo.png)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, Flask |
| Image Processing | Pillow (PIL) |
| Frontend | HTML5, CSS3, JavaScript |
| Desktop Window | PyWebView |
| Packaging | PyInstaller |
| Installer | Inno Setup 6 |

---

## 📂 Project Structure

```
image-compressor/
│
├── app.py                  # Flask backend (compression logic)
├── desktop.py              # Desktop app entry point (PyWebView)
├── Imress.iss              # Inno Setup installer script
│
├── static/
│   ├── style.css           # UI styling & animations
│   ├── script.js           # Frontend logic
│   └── images/
│       ├── logo.png        # Imress logo
│       └── icon.ico        # App icon
│
├── templates/
│   └── index.html          # Main HTML page
│
├── dist/
│   └── Imress.exe          # Compiled desktop executable
│
└── installer_output/
    └── Imress_Setup.exe    # Windows installer
```

---

## ⚙️ Installation & Setup (For Developers)

### Prerequisites
- Python 3.8 or higher
- pip

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/imress.git
cd imress
```

**2. Create and activate virtual environment**
```bash
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Mac/Linux
```

**3. Install dependencies**
```bash
pip install flask pillow pywebview pyinstaller
```

**4. Run the app**
```bash
python desktop.py
```

---

## 📦 Build Executable (Windows)

To build a standalone `.exe`:

```bash
pyinstaller --onefile --windowed --add-data "templates;templates" --add-data "static;static" --icon "static\images\icon.ico" --name Imress desktop.py
```

The output will be at `dist/Imress.exe`.

---

## 💿 Build Windows Installer

1. Install [Inno Setup 6](https://jrsoftware.org/isdl.php)
2. Open `Imress.iss` in Inno Setup Compiler
3. Press `Ctrl + F9` to compile
4. Installer will be generated at `installer_output/Imress_Setup.exe`

---

## 🚀 How to Use

1. Launch **Imress** from desktop shortcut or Start Menu
2. **Drag & Drop** images into the upload area, or click to browse
3. Images will be compressed automatically — watch the live status table
4. Once complete:
   - Click **⬇️ Download** next to any image to save it individually
   - Click **📦 Download All as ZIP** to get all images in one file
5. Add more images anytime — previous results stay visible in the same session

---

## 📊 Supported Formats

| Format | Input | Output |
|--------|-------|--------|
| JPEG / JPG | ✅ | ✅ |
| PNG | ✅ | ✅ |
| WEBP | ✅ | ✅ |

---

## 🔒 Privacy

Imress processes all images **locally on your device**. No images are uploaded to any server or cloud. Your files never leave your computer.

---

## 👩‍💻 Developer

**Developed by:** [Your Name]  
**Degree:** BS Artificial Intelligence  
**GitHub:** [github.com/yourusername](https://github.com/yourusername)  

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use, modify, and distribute.

```
MIT License

Copyright (c) 2026 Imress

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

<p align="center">Made with ❤️ by Imress Team</p>
