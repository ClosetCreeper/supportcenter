import crypto from 'crypto';
import fetch from 'node-fetch';

const CONTAINER = process.env.CLOUDKIT_CONTAINER;
const ENV = process.env.CLOUDKIT_ENVIRONMENT;
const KEY_ID = process.env.CLOUDKIT_KEY_ID;
const PRIVATE_KEY = process.env.CLOUDKIT_PRIVATE_KEY;

// Create signature headers
function signRequest(body) {
  const timestamp = new Date().toISOString();
  const data = Buffer.from(JSON.stringify(body));

  const sign = crypto.createSign('sha256');
  sign.update(data);
  sign.end();

  const signature = sign.sign(PRIVATE_KEY, 'base64');

  return {
    'X-Apple-CloudKit-Request-KeyID': KEY_ID,
    'X-Apple-CloudKit-Request-ISO8601Date': timestamp,
    'X-Apple-CloudKit-Request-SignatureV1': signature,
    'Content-Type': 'application/json'
  };
}

export default async function handler(req, res) {
  const { action, phone, reason, recordName } = req.body;

  if (!action) return res.status(400).json({ error: 'Missing action' });

  try {
    let body;
    let url = `https://api.apple-cloudkit.com/database/1/${CONTAINER}/${ENV}/public/records`;

    if (action === 'lookup') {
      url += '/query';
      body = {
        recordType: 'BannedUsers',
        filterBy: [{
          fieldName: 'userID',
          comparator: 'EQUALS',
          fieldValue: { value: `user_${phone}` }
        }]
      };
    } else if (action === 'ban') {
      url += '/modify';
      body = {
        records: [{
          recordType: 'BannedUsers',
          fields: {
            userID: { value: `user_${phone}` },
            banReason: { value: reason },
            banStatus: { value: 1 }
          }
        }]
      };
    } else if (action === 'unban') {
      url += '/modify';
      body = {
        records: [{
          recordName,
          fields: { banStatus: { value: 0 } }
        }]
      };
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const headers = signRequest(body);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();
    res.status(200).json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
