<p align="center">
  <img src="frontend/static/images/logo.png" alt="Imress" width="440">
</p>

<h3 align="center">Private, high-speed image compression for Windows.</h3>

<p align="center">
  Compress JPEG, PNG, and WebP images in batches—entirely on your device.
</p>

<p align="center">
  <strong>Windows 10/11</strong> &nbsp;•&nbsp; <strong>Electron</strong> &nbsp;•&nbsp; <strong>Sharp</strong> &nbsp;•&nbsp; <strong>Offline-first</strong> &nbsp;•&nbsp; <strong>MIT License</strong>
</p>

<p align="center">
  <a href="https://github.com/MaryamFatima5/Imress-Image-Compressor-Tool/releases/latest/download/Imress.Setup.1.0.0.exe">
    <img src="frontend/static/images/download-windows.svg" alt="Download Imress for Windows" width="300">
  </a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://github.com/MaryamFatima5/Imress-Image-Compressor-Tool/releases">View all releases</a>
</p>

<p align="center">
  <sub>Windows installer · 64-bit · Download starts immediately</sub>
</p>

---

## Why Imress?

Imress is a focused desktop app for making image files smaller without sending them to a cloud service. Drop in a batch, compress it, review the savings, and save files individually or as one ZIP archive.

- **Batch ready** — add multiple images at once with drag and drop.
- **Fast by design** — powered by Sharp with multi-core processing.
- **Clear results** — compare original and optimized sizes per file.
- **Flexible export** — save individual files or download the full batch as a ZIP.
- **Private by default** — processing stays on your computer.

## Product tour

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="frontend/static/images/s1.png" alt="Imress startup screen" width="100%">
      <p align="center"><sub>Fast, polished desktop startup</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src="frontend/static/images/s2.png" alt="Imress drag and drop upload screen" width="100%">
      <p align="center"><sub>Drag, drop, and select your files</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="frontend/static/images/s3.png" alt="Imress batch compression queue" width="100%">
      <p align="center"><sub>Review a batch before compression</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src="frontend/static/images/s4.png" alt="Imress compression results" width="100%">
      <p align="center"><sub>See savings and export your results</sub></p>
    </td>
  </tr>
</table>

> All visuals above are static, local repository assets—no remote image services, generated badges, animations, or runtime-rendered artwork.

## How it works

1. **Add images** — drag files into Imress or browse from your computer.
2. **Compress** — optimize the selected batch with a single click.
3. **Save** — download each optimized image or export everything as a ZIP.

## Supported formats

| Format | Input | Output |
| :-- | :--: | :--: |
| JPEG / JPG | ✓ | ✓ |
| PNG | ✓ | ✓ |
| WebP | ✓ | ✓ |

## Privacy

Your images are processed locally by the app. Imress does not upload files to a remote server or require an account to compress them.

## Run from source

### Requirements

- Node.js 18 or later
- npm
- Windows for the packaged desktop installer

```bash
git clone https://github.com/MaryamFatima5/Imress-Image-Compressor-Tool.git
cd Imress-Image-Compressor-Tool
npm install
npm run dev
```

### Build the Windows installer

```bash
npm run build
```

The installer is created in `dist-electron/`.

## Built with

| Layer | Technology |
| :-- | :-- |
| Desktop shell | Electron |
| Compression engine | Sharp |
| Local service | Node.js + Express |
| Archive export | Archiver + JSZip |

## License

Distributed under the [MIT License](LICENSE).

<p align="center">
  <sub>Made for smaller files and a simpler workflow.</sub>
</p>
