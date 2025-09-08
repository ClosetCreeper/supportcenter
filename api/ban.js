// api/ban.js
import fetch from "node-fetch";

const CONTAINER = "iCloud.keyninestudios.topten"; // CloudKit container
const API_KEY = "ece865511ed4a5bf7b94a517280aa85ba5c8b1e7c913be1030ad17d9bf63434a";              
const BASE_URL = `https://api.apple-cloudkit.com/database/1/${CONTAINER}/production/public/records`;

export default async function handler(req, res) {
  const { phone, action, recordName, reason } = req.query;

  try {
    let body;
    let url = BASE_URL;

    if (action === "lookup") {
      body = {
        query: {
          recordType: "BannedUsers",
          filterBy: [{
            fieldName: "userID",
            comparator: "EQUALS",
            fieldValue: { value: `user_${phone}` }
          }]
        }
      };
      url += "/query";
    } else if (action === "ban") {
      body = {
        operations: [{
          operationType: "create",
          record: {
            recordType: "BannedUsers",
            fields: {
              userID: { value: `user_${phone}` },
              banReason: { value: reason },
              banStatus: { value: 1 }
            }
          }
        }]
      };
      url += "/modify";
    } else if (action === "unban") {
      body = {
        operations: [{
          operationType: "update",
          record: {
            recordName,
            recordType: "BannedUsers",
            fields: {
              banStatus: { value: 0 }
            }
          }
        }]
      };
      url += "/modify";
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Apple-CloudKit-Request-KeyID": API_KEY,
        "X-Apple-CloudKit-Request-ISO8601Date": new Date().toISOString(),
        "X-Apple-CloudKit-Request-SignatureV1": "placeholder"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
