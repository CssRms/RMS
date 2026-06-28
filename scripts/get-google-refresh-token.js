// One-time, run locally by the super admin only: node scripts/get-google-refresh-token.js
//
// Before running, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as env vars - get these by
// creating an OAuth 2.0 Client ID of type "Desktop app" in Google Cloud Console
// (console.cloud.google.com -> APIs & Services -> Credentials), with the Drive API enabled
// on that project.
//
// Uses the loopback redirect flow (Google's replacement for the deprecated copy/paste "oob"
// flow): this briefly starts a local web server, opens the consent URL, and Google redirects
// straight back to it automatically once you approve - no code to copy/paste. Prints a
// refresh token at the end - that's the GOOGLE_REFRESH_TOKEN GitHub secret. It does not
// expire from time alone (only from inactivity, revocation, or account security changes),
// so this is a one-time setup step, not something to re-run regularly.
const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first.');
  process.exit(1);
}

const server = http.createServer();
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const redirectUri = `http://localhost:${port}`;
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent', // forces a refresh_token even if this account authorized before
  });

  console.log('\nOpen this URL and sign in with the Google account that should own the backups:\n');
  console.log(authUrl);
  console.log('\nWaiting for you to approve access in the browser...\n');

  server.on('request', async (req, res) => {
    const url = new URL(req.url, redirectUri);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.end('Authorization failed - you can close this tab.');
      console.error(`\nGoogle returned an error: ${error}`);
      server.close();
      process.exit(1);
    }
    if (!code) {
      res.end('Waiting...');
      return;
    }

    res.end('Authorization complete - you can close this tab now.');
    server.close();

    try {
      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        console.error('\nNo refresh_token returned - this account may have already authorized this app. Revoke access at https://myaccount.google.com/permissions and try again.');
        process.exit(1);
      }
      console.log('GOOGLE_REFRESH_TOKEN:\n');
      console.log(tokens.refresh_token);
      console.log('\nSave this as the GOOGLE_REFRESH_TOKEN GitHub secret.');
    } catch (err) {
      console.error('\nFailed to exchange code for tokens:', err.message);
      process.exit(1);
    }
  });
});
