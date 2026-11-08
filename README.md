<p align="center">
  <img src="repo_assets/banner.png" alt="Whitebloom Extended" width="640">
</p>

<p align="center">
  <b>A local, plaintext-first, modular whiteboard — extended.</b><br>
  <a href="../../releases/latest">Download the latest release</a> ·
  <a href="#whats-new-in-extended">What's new in Extended</a> ·
  <a href="#building-from-source">Build from source</a>
</p>

---

**Whitebloom Extended** is a fork of [whitevanillaskies/whitebloom](https://github.com/whitevanillaskies/whitebloom). The app is still called **Whitebloom**: everything from the original is here, plus a set of features focused on drawing, writing and day-to-day comfort (pen colors, text formatting, dark mode, image export, Quick Access and more).

![Whitebloom](repo_assets/whiteboard_pic.jpg)

## What is Whitebloom?

Whitebloom is a **desktop whiteboard that lives on your disk**. There is no cloud and no account: your boards are plain files in folders you control, so you can back them up, sync them with any service, or keep them in Git.

- **Workspaces** are ordinary folders. Each one holds your boards (`*.wb.json`), the files you import, and your ink.
- **Boards** are infinite canvases where you mix text, shapes, connections, images, ink, and real files from your computer.
- **Modules ("blooms")** let some nodes open into a full editor inside the board: double-click a note, a PDF, a Markdown file or a schema and it *blooms* into its editor, without leaving Whitebloom.

Whitebloom is desktop only (Windows and Linux builds; macOS can be built from source).

## How it works

### Boards and nodes

There are three kinds of nodes:

- **Leafs**: simple content that lives on the board, like text and shapes. Double-click to edit.
- **Buds**: nodes that *bloom* into an editor: Focus Writer notes, PDFs, Markdown documents, schemas, embedded web pages, other boards.
- **Externals**: any other file (images, spreadsheets, PureRef boards…). Double-clicking opens it in your system's default app.

Group nodes into **clusters** (frames), connect them with **edges** (with labels and styles), and draw freely on the **ink layer**.

### Navigation

| Action | How |
|---|---|
| Pan | Middle mouse button, or hold `Space` and drag |
| Zoom | Mouse wheel (0.02× – 16×) |
| Select / move | Left mouse button; drag on empty space to select an area |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`) |
| Copy / cut / paste | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` (pastes under the cursor) |
| Back to the pointer | `Esc` |

**Tool shortcuts** (hover any tool to see its shortcut):

| Tool | Key |
|---|---|
| Select | `V` |
| Hand | `H` |
| Text | `T` (type `/` on a new line for headings, lists, quotes…) |
| Shapes | `S` |
| Pen | `P` (press again to switch to the eraser) |
| Eraser | `E` (press again to switch back to the pen) |
| Show/hide ink layer | `L` |

### Command palette

Almost everything can be done from the keyboard. Press **`Tab`** to open the command palette and type what you want to do (create nodes, open the Materials window, change tools…). **`Alt+X`** opens the advanced *meta* palette.

### Materials

Every file or link you bring into a workspace becomes a **material**, shared by all boards in that workspace. Open the **Materials** window from the command palette to organize them:

- **Bins** are exclusive buckets (a material lives in one bin, or in *Loose*). Deleting is done by dragging to the trash bin, which first checks whether any board still uses the material.
- **Sets** are inclusive, hierarchical labels (like Gmail labels).

Arranging materials never moves the real files on disk.

### Importing vs. linking files

Drag files from your file explorer straight onto the board:

- **Import** copies the file into the workspace, so the workspace stays self-contained.
- **Link** points to the original file, which is lighter and always up to date, but breaks if the file is moved or renamed.

Pick the default in **Settings → App** (or choose per file). Dropping an **Obsidian vault** folder creates a node that opens the vault in Obsidian.

### Recording your session

Open the meta palette (`Alt+X`) and run `screen.start-recording` to record the window (with microphone) to a `.webm` in the workspace's `recordings/` folder. Stop with `screen.stop-recording` or **`F8`**.

## What's new in Extended

### Pen color and thickness
A pen tray in the style of Microsoft Whiteboard: quick color dots in the ink toolbar, and a popover (click the active pen again) with 18 colors plus a custom color, thickness presets, a slider, a **pressure sensitivity** toggle (for graphics tablets) and a live stroke preview. Your last pen is remembered, and it also works on PDFs. While erasing, a small guide dot (in your crosshair color) shows exactly where you erase.

### Text formatting and auto-fit
The text toolbar now has a **font picker** (bundled fonts plus common system fonts), **font size** (A− / size list / A+) and an **auto-fit** toggle: the text scales to fill its own box, which you resize from the corner. With the caret in the text, changes apply to the whole box. With a selection, they apply to the selected text.

### Dark mode
**Light / Dark / System** themes in Settings → App. The whole interface follows the theme, and near-black ink is shown light on a dark board (like Whiteboard), without changing the stored strokes.

### Crosshair color
Choose the color of the crosshair cursor used by the text, shape and ink tools (or keep the system default).

### Export as image
A new **Export** button in the board bar:
- **Export all**: automatically crops to everything on the board.
- **Export area**: dims the board and shows a selection rectangle you move and resize from its corners. Drag outside it (or with the middle button) to move the board underneath, and scroll to zoom, then export.

Formats: **PNG, JPG, JPEG, WebP, BMP**, at the highest resolution the GPU safely allows (up to 4×).

### Start screen
- **Recently** (default view): your most recent boards.
- **Quick Access**: pin folders with **+** and browse the workspaces inside them. When you create a workspace in a folder that isn't pinned yet, Whitebloom offers to add it (with a "don't ask again" option, also in Settings).
- A **settings gear** in the top-right corner.
- **Trash** (bottom-left): deleted boards go here. Restore them to their original folder, or delete them forever.

### Selection, undo and redo
- **Area selection picks everything it touches**: nodes, images, shapes, clusters and **ink strokes**. Move it all together (one undo step) or delete it with `Delete`.
- **Copy, cut and paste** (`Ctrl+C` / `Ctrl+X` / `Ctrl+V`) any selection, ink included. Pasting places it right under the cursor, already selected.
- **Reliable undo/redo** for every change on the board (create, move, resize, text, styles, delete, ink…), with a deep history. Large undos are instant, even with hundreds of strokes.

### Quality of life
- Much wider zoom range for every tool (0.02× – 16×).
- **Smoother panning and zooming**: ink is cached instead of being recomputed every frame (~9× cheaper), and images/videos no longer re-render while you move.
- **Background dots** can be hidden per board (Board settings) or on all boards (Settings → App).
- Faster startup: the board editor and heavy modules (PDF, Markdown, schemas…) load on demand, and the package is ~10× smaller (`app.asar` 254 MB → 21 MB).
- A new **sakura app icon** and an assisted Windows installer that lets you choose the install folder.
- **English by default**: the app and the installer switch to Spanish automatically on Spanish systems (changeable in Settings).

## Download

Get the installer from the [Releases page](../../releases/latest):

- **`Whitebloom-Setup-x.y.z.exe`**: Windows installer (choose where to install, creates shortcuts). Recommended.
- **`WHITEBLOOM-x.y.z-win.zip`**: no-install version. Unzip it anywhere and run `WHITEBLOOM.exe`.

> The executables are not code-signed, so Windows SmartScreen may warn the first time. Click **More info → Run anyway**.

## Building from source

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build:win
```

`npm run build:linux` and `npm run build:mac` are also available (each must be run on its own OS).

### Regenerating the icon and installer artwork

The app icon is generated from code, so it can be tweaked and rebuilt:

```bash
node scripts/generate-icon.mjs > build/icon.svg
```

```bash
npx electron scripts/rasterize-icon.cjs
```

```bash
npx electron scripts/render-installer-art.cjs
```

## Credits

Whitebloom was created by [White Vanilla Skies](https://github.com/whitevanillaskies). Follow the original project on [X](https://x.com/__whitebloom__), and consider supporting it on [Ko-fi](https://ko-fi.com/whitebloom).

Whitebloom Extended is maintained by [KirouGC](https://github.com/KirouGC).

## License

Apache 2.0 + Commons Clause, inherited from the original project.

This project is licensed under the Apache License 2.0 with the Commons Clause. Commercial use, corporate deployment, government use, or any "selling" (as defined in the Commons Clause) requires a separate paid license from the original author. Contact whitevanillaskies@proton.me for details.
