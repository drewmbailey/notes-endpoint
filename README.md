# Notes Endpoint

A REST API for saving markdown notes to Google Drive with automated GitHub backups.

## Features

- Save markdown notes to Google Drive organized by category
- Daily automated backups to GitHub (3 AM ET)
- Auto-generated index files for easy navigation
- API key authentication with rate limiting

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your credentials:
```env
PORT=8080
API_KEY=your-secret-key

# Google Drive
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
NOTES_FOLDER_ID=your-drive-folder-id

# GitHub
GITHUB_TOKEN=your-github-token
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=your-repo
```

**First time setup?** See [SETUP.md](SETUP.md) for detailed instructions on obtaining all credentials.

3. Run the server:
```bash
npm start
```

## API Usage

### Save a Note

```bash
POST /api/save-note
Headers: x-api-key: your-secret-key
Content-Type: application/json

{
  "category": "Personal",
  "filename": "my-note.md",
  "content": "# My Note\n\nContent here..."
}
```

### Health Check

```bash
GET /health
```


## Automated Backups

Notes are automatically backed up to GitHub daily at 3 AM ET. The backup includes:
- All notes with YAML front-matter (created/updated timestamps)
- Index files for each category
- Root index linking all categories

## Security

- API key authentication on all endpoints
- Rate limiting: 100 requests per 15 minutes
- Input validation for filenames and categories
- 2MB content size limit

## License

MIT
