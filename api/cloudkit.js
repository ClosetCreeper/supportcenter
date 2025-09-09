import jwt from "jsonwebtoken";
import fetch from "node-fetch";

const keyId = process.env.CLOUDKIT_KEY_ID;           // CloudKit Key ID
const teamId = process.env.CLOUDKIT_TEAM_ID;         // Apple Developer Team ID
const container = process.env.CLOUDKIT_CONTAINER;   // e.g. iCloud.keyninestudios.topten
const privateKey = process.env.CLOUDKIT_PRIVATE_KEY.replace(/\\n/g, '\n'); // Stored securely in Vercel

export default async function handler(req, res) {
  try {
    const { action, phoneNumber, reason } = req.body;

    if (!phoneNumber) return res.status(400).json({ error: "Missing phoneNumber" });

    // Generate JWT for CloudKit server-to-server
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 3600,
      aud: "https://api.apple-cloudkit.com",
      sub: container
    };

    const token = jwt.sign(payload, privateKey, { algorithm: "ES256", keyid: keyId });

    const userID = `user_${phoneNumber}`;
    let ckPayload;
    let url;

    if (action === "lookup") {
      url = `https://api.apple-cloudkit.com/database/1/${container}/production/public/records/query`;
      ckPayload = {
        recordType: "BannedUsers",
        filterBy: [
          { fieldName: "userID", comparator: "EQUALS", fieldValue: { value: userID } }
        ]
      };
    } else if (action === "ban") {
      if (!reason) return res.status(400).json({ error: "Missing reason" });
      url = `https://api.apple-cloudkit.com/database/1/${container}/production/public/records/modify`;
      ckPayload = {
        operations: [
          {
            operationType: "create",
            record: {
              recordType: "BannedUsers",
              fields: {
                userID: { value: userID },
                banReason: { value: reason },
                banStatus: { value: 1 }
              }
            }
          }
        ]
      };
    } else if (action === "unban") {
      url = `https://api.apple-cloudkit.com/database/1/${container}/production/public/records/modify`;
      ckPayload = {
        operations: [
          {
            operationType: "update",
            record: {
              recordType: "BannedUsers",
              recordName: userID,
              fields: { banStatus: { value: 0 } }
            }
          }
        ]
      };
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Apple-CloudKit-Request-KeyID": keyId,
        "X-Apple-CloudKit-Request-ISO8601Date": new Date().toISOString(),
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(ckPayload)
    });

    // Read body **once**
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } 
    catch (err) { data = { raw: text }; }

    res.status(response.status).json(data);

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
}
