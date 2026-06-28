// One-time, run locally by the super admin only: node scripts/get-google-refresh-token.js
//
// Before running, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as env vars - get these by
// creating an OAuth 2.0 Client ID of type "Desktop app" in Google Cloud Console
// (console.cloud.google.com -> APIs & Services -> Credentials), with the Drive API enabled
// on that project.
//
// This prints a URL. Open it, sign in with the Google account that should own the backups,
// approve access, then paste the code it gives you back into this script's prompt. It
// prints a refresh token - that's the GOOGLE_REFRESH_TOKEN GitHub secret. It does not
// expire from time alone (only from inactivity, revocation, or account security changes),
// so this is a one-time setup step, not something to re-run regularly.
const readline = require('readline');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'urn:ietf:wg:oauth:2.0:oob');
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.file'],
  prompt: 'consent', // forces a refresh_token even if this account authorized before
});

console.log('\n1. Open this URL and sign in with the Google account that should own the backups:\n');
console.log(authUrl);
console.log('\n2. Approve access, then paste the code shown back here.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Code: ', async (code) => {
  rl.close();
  const { tokens } = await oauth2Client.getToken(code.trim());
  if (!tokens.refresh_token) {
    console.error('\nNo refresh_token returned - this account may have already authorized this app. Revoke access at https://myaccount.google.com/permissions and try again.');
    process.exit(1);
  }
  console.log('\nGOOGLE_REFRESH_TOKEN:\n');
  console.log(tokens.refresh_token);
  console.log('\nSave this as the GOOGLE_REFRESH_TOKEN GitHub secret.');
});
