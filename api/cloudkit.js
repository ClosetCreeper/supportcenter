import jwt from "jsonwebtoken";
import fetch from "node-fetch";

const keyId = process.env.CLOUDKIT_KEY_ID;           // The Key ID from CloudKit
const teamId = process.env.CLOUDKIT_TEAM_ID;         // Your Apple Developer Team ID
const container = process.env.CLOUDKIT_CONTAINER;   // e.g. iCloud.keyninestudios.topten
const privateKey = process.env.CLOUDKIT_PRIVATE_KEY; // Your PEM private key, with \n for line breaks

export default async function handler(req, res) {
  try {
    const { action, phoneNumber, reason } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Missing phoneNumber" });
    }

    // Generate JWT for CloudKit server-to-server authentication
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 3600,   // 1 hour
      aud: "https://api.apple-cloudkit.com",
      sub: container
    };

    const token = jwt.sign(payload, privateKey, {
      algorithm: "ES256",
      keyid: keyId
    });

    // Construct CloudKit request
    const url = `https://api.apple-cloudkit.com/database/1/${container}/production/public/records/query`;

    // Determine userID format
    const userID = `user_${phoneNumber}`;

    let ckPayload;

    if (action === "lookup") {
      ckPayload = {
        recordType: "BannedUsers",
        filterBy: [{ fieldName: "userID", comparator: "EQUALS", fieldValue: { value: userID } }]
      };
    } else if (action === "ban") {
      if (!reason) return res.status(400).json({ error: "Missing ban reason" });
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

    let data;
    try {
      data = await response.json();
    } catch (err) {
      data = { raw: await response.text() };
    }

    res.status(response.status).json(data);

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
}
