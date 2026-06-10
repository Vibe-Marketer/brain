# Exporting Your Transcripts

CallVault lets you export your transcripts in multiple formats for sharing, backup, or use in other tools.

## Available Formats

### PDF
Best for sharing and printing. Creates a professional document with:
- Call title and date
- Full transcript text
- Summary (if generated)
- Tags

### Word (DOCX)
Editable format for Microsoft Word and Google Docs. Perfect for:
- Adding notes
- Editing content
- Formatting for reports

### Plain Text (TXT)
Simple format compatible with any text editor. Ideal for:
- Quick sharing
- Import into other tools
- Minimal file size

### JSON
Structured data format for developers. Includes:
- All call metadata
- Transcript text
- Tags and folders
- Timestamps

### ZIP Archive
Export multiple transcripts at once. Contains:
- One file per transcript
- Consistent naming
- Your choice of format

### Markdown
Formatted text with headers and structure. Great for:
- Knowledge bases
- Note-taking apps (Notion, Obsidian)
- Documentation

### Obsidian ZIP
Vault-ready Markdown export for Obsidian. The Settings export downloads all calls into a
`CallVault/{organization}/{workspace}/` folder structure, while the Smart Export dialog can export
only selected calls as an Obsidian Vault ZIP. Large vault export planning targets at least 5,000
transcript-bearing calls without a fixed low export cap.

### Obsidian Markdown
Per-call Obsidian export downloads the current call as one standalone `.md` note from the call
Transcript tab. Use **Export to Obsidian** when you want the open call as portable Markdown with
YAML front matter, participant wikilinks, source URL metadata when available, and the transcript
body preserved.

### CSV
Spreadsheet format for data analysis. Includes:
- Call metadata in columns
- Easy filtering and sorting
- Bulk analysis

## How to Export

### Single Transcript
1. Open the transcript detail view
2. Open the **Transcript** tab
3. Choose TXT, MD, PDF, DOCX, or **Export to Obsidian**
4. File downloads automatically

### Multiple Transcripts
1. Select transcripts using checkboxes
2. Bulk action panel appears
3. Click **Export** dropdown
4. Choose format (files bundled as ZIP if multiple)

### Full Vault to Obsidian
1. Open **Settings → Integrations**
2. Find **Export vault**
3. Click **Download all calls**
4. Move the downloaded Obsidian ZIP contents into your vault root

### Selected Calls to Obsidian
1. Select transcript(s)
2. Click **Smart Export**
3. Choose the Obsidian Vault ZIP format
4. Move the selected-call ZIP contents into your vault root

### Smart Export
For AI-ready export with summaries and action items:
1. Select transcript(s)
2. Click **Smart Export**
3. Choose what to include (summary, action items, quotes)
4. Export with enhanced content

## Tips

- **Large exports**: ZIP format recommended for 10+ transcripts
- **Sharing**: PDF creates the most professional appearance
- **Editing**: DOCX preserves formatting while allowing changes
- **Backup**: JSON preserves all data including metadata
- **Obsidian**: use **Export to Obsidian** for one call as a single `.md` file, full-vault ZIP for
  every call under `CallVault/{organization}/{workspace}/`, and Smart Export for selected-call ZIPs
