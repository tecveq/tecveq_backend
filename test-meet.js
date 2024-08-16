const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { SpacesServiceClient, ConferenceRecordsServiceClient } = require('@google-apps/meet').v2;
const { auth } = require('google-auth-library');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/meetings.space.created'];

// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const ATTENDANCE_PATH = path.join(process.cwd(), 'attendence.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return auth.fromJSON(credentials);
  } catch (err) {
    console.log(err);
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
const authorize = async () => {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Creates a new meeting space.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
const createSpace = async (authClient) => {

  const meetClient = new SpacesServiceClient({
    authClient: authClient
  });
  // Construct request
  const request = {
  };

  // Run request
  const response = await meetClient.createSpace(request);
  console.log(`Meet URL: ${response[0].meetingUri}`);
  return response[0];
}

const getMeetingParticipents = async (authClient, meetingData) => {
  try {
    const meetingClient = new ConferenceRecordsServiceClient({
      authClient:authClient
    });

    console.log("meeting name is : ", meetingData.name );
    // projId = tca-backend-454ca
    // loc = global
    // parent resource type = 
    // parent resource id = 
    const request = {
      name: meetingData.name.split("/")[1],
    };

    const response = await meetingClient.getConferenceRecord(request);

    console.log("resonse from meet is : ", response);

    // const iterable = meetingClient.listParticipantsAsync(request);
    // for await (const response of iterable) {
    //   console.log(response);
    // }
    // console.log("meeting response is : ", response);

    return response;

  } catch (error) {
    console.error('Error fetching participants:', error);
    return [];
  }
}

const recordAttendance = async (meetingId, participants) => {
  try {
    const attendanceRecord = {
      meetingId: meetingId,
      timestamp: new Date().toISOString(),
      participants: participants,
    };

    // await fs.writeFile(ATTENDANCE_PATH, JSON.stringify(attendanceRecord, null, 2));
    console.log('Attendance recorded successfully.');
  } catch (error) {
    console.error('Error recording attendance:', error);
  }
}



module.exports = { authorize, createSpace, getMeetingParticipents, recordAttendance, getMeetingParticipents }
