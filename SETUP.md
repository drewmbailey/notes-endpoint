# Setup Guide

This guide walks you through setting up all required credentials for the Notes Endpoint API.

## Table of Contents

- [API Key Setup](#api-key-setup)
- [Google Drive Setup](#google-drive-setup)
- [GitHub Setup](#github-setup)

---

## API Key Setup

The `API_KEY` is a **custom secret key you create yourself** to secure your API endpoint. Generate a secure random key using:

```bash
# Option 1: Using openssl (recommended)
openssl rand -hex 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Generate a UUID
uuidgen
```

Copy the generated key and add it to your `.env` file:
```env
API_KEY=e8c142d0e1a59eb36e05706921c5241ba960286d321df1f9df6e71656b51470a
```

**Security Tips:**
- Generate a long, random key (32+ characters)
- Keep it secret (never commit `.env` to git)
- Use different keys for development and production
- Rotate periodically if compromised

---

## Google Drive Setup

You need four Google Drive environment variables. Here's how to get each one:

### 1. Get `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the Google Drive API:
   - Go to **APIs & Services** → **Library**
   - Search for "Google Drive API"
   - Click **Enable**
4. Configure OAuth Consent Screen (if not already done):
   - Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External** user type (unless you have a Google Workspace)
   - Fill in the required fields on the **App information** page:
     - App name: "Notes API" (or any name)
     - User support email: your email
     - Developer contact: your email
   - Click **Save and Continue**
   - On the **Scopes** page: Click **Save and Continue** (no changes needed)
   - On the **Test users** page:
     - Click **+ Add Users** button
     - Enter your Google account email (the one you'll use for Drive)
     - Click **Add**
     - **Important:** Only test users can authenticate when in Testing mode
     - Click **Save and Continue**
   - Review the summary page and click **Back to Dashboard**
   - Your app will be in "Testing" mode (this is fine for personal use)
   
   **If you already configured the consent screen** and need to add test users:
   - Method 1: Go to **APIs & Services** → **OAuth consent screen**, scroll to **Test users**, click **+ Add Users**
   - Method 2 (newer interface): Navigate to **Google Auth Platform** → **Audience** in the left sidebar, then add test users there
   - Add your email and click **Save**
   
   **If you lost your Client Secret** and need to add a new one:
   - Go to **APIs & Services** → **Credentials**
   - Click on your OAuth client name
   - Click **"ADD SECRET"** button
   - Look for a **small copy icon** next to the newly generated secret (it's easy to miss!)
   - Click the copy icon immediately - you can only view it once!

5. Create OAuth 2.0 credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Choose **Application type**: Web application
   - Name it (e.g., "Notes API")
   - Under **Authorized redirect URIs**, click **Add URI**
     - Add: `https://developers.google.com/oauthplayground`
   - **Note:** You do NOT need to add "Authorized JavaScript origins" (leave that section empty)
   - Click **Create**
6. After creation, you'll see your credentials:
   - **Client ID**: Visible on the page (click the copy icon next to it)
   - **Client secret**: Look for a **small copy icon** next to the secret field (easy to miss!)
   - Click each copy icon to copy the values
   - **Important**: Save these immediately - you can only view the secret once!

### 2. Get `GOOGLE_REFRESH_TOKEN`

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click the gear icon in the top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret from step 1
5. In the left panel, scroll down to "Drive API v3"
6. Select `https://www.googleapis.com/auth/drive` (full Drive access)
7. Click **Authorize APIs**
8. Sign in with your Google account and grant permissions
9. Click **Exchange authorization code for tokens**
10. Copy the **Refresh token** that appears

### 3. Get `NOTES_FOLDER_ID`

1. Go to [Google Drive](https://drive.google.com/)
2. Create a new folder for your notes (or select an existing one)
3. Open the folder
4. Look at the URL in your browser:
   ```
   https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P
                                          └─────────────────┬─────────────────┘
                                                    This is your NOTES_FOLDER_ID
   ```
5. Copy the folder ID from the URL

**Example:**
If your URL is `https://drive.google.com/drive/folders/1ABCdefGHIjklMNOpqrSTUVwxyz`, then:
```env
NOTES_FOLDER_ID=1ABCdefGHIjklMNOpqrSTUVwxyz
```

---

## GitHub Setup

You need three GitHub environment variables:

### 1. Create a Backup Repository

1. Go to [GitHub](https://github.com/)
2. Click the **+** icon → **New repository**
3. Name it (e.g., `notes-backup`)
4. Make it **Private** (recommended) or Public
5. Click **Create repository**

### 2. Get `GITHUB_TOKEN`

1. Go to [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click **Generate new token** → **Generate new token (classic)**
3. Give it a descriptive name (e.g., "Notes Backup API")
4. Select scopes:
   - `repo` (Full control of private repositories)
5. Click **Generate token**
6. **Important:** Copy the token immediately (you won't see it again!)

### 3. Set Repository Variables

```env
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=notes-backup
```

Replace `your-github-username` with your actual GitHub username, and `notes-backup` with your repository name.

---

## Complete .env Example

After completing all the steps above, your `.env` file should look like this:

```env
PORT=8080
API_KEY=your-generated-secret-key

# Google Drive
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REFRESH_TOKEN=1//your-refresh-token
NOTES_FOLDER_ID=1ABCdefGHIjklMNOpqrSTUVwxyz

# GitHub
GITHUB_TOKEN=ghp_yourPersonalAccessToken
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=notes-backup
```

---

## Troubleshooting

### Google OAuth Issues

- **"Access blocked: This app's request is invalid"**: Make sure you added yourself as a test user in the OAuth consent screen
- **"Invalid refresh token"**: The token may have expired. Regenerate it using the OAuth Playground
- **"Insufficient permissions"**: Ensure you selected the full `https://www.googleapis.com/auth/drive` scope

### GitHub Issues

- **"Bad credentials"**: Verify your GitHub token is correct and has the `repo` scope
- **"Not Found"**: Check that your repository owner and name are correct (case-sensitive)

---

Need help? Open an issue on the repository or check the [README](README.md) for API usage examples.

