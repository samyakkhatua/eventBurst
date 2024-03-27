const express = require("express");
const qr = require("qr-image");
const bodyParser = require("body-parser");
const cloudinary = require("../cloudinaryConfig.js");
const crypto = require("crypto");
const https = require("https");

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.status(200).send(`
      <html>
        <head>
          <title>EVENT BURST</title>
          
        </head>
        <body>
          <h1>Welcome to the Event Ticket Generator!</h1>
          <p>Why did the developer go broke? Because he used up all his cache!</p>
        </body>
      </html>
    `);
});

app.use(bodyParser.json());

async function generateAndUploadQRCode(uniqueID) {
  const pngBuffer = qr.imageSync(uniqueID, { type: "png" });
  const imageBase64 = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(imageBase64);
  return result.url;
}

async function addQRlinkToContact(contactId, qrCodeUrl) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      fields: [
        {
          slug: "esummit_ticket_qr_link",
          value: qrCodeUrl,
        },
      ],
    });

    const options = {
      hostname: "api.systeme.io",
      path: `/api/contacts/${contactId}`,
      method: "PATCH",
      headers: {
        "X-API-Key": process.env.SYSTEME_X_API_KEY,
        "Content-Type": "application/merge-patch+json",
        "Content-Length": data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        resolve(JSON.parse(responseBody));
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function addTagToContact(contactId, tagId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      tagId: tagId,
    });

    const options = {
      hostname: "api.systeme.io",
      path: `/api/contacts/${contactId}/tags`,
      method: "POST",
      headers: {
        "X-API-Key": process.env.SYSTEME_X_API_KEY,
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        if (responseBody) {
          try {
            const parsedResponse = JSON.parse(responseBody);
            resolve(parsedResponse);
          } catch (error) {
            reject(new Error("Failed to parse JSON response"));
          }
        } else {
          resolve({});
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

app.post("/api/ticket", async (req, res) => {
  try {
    const { PaymentID, contactId } = req.body;

    if (!PaymentID) {
      return res.status(400).send("PaymentID is missing");
    }
    if (!contactId) {
      return res.status(400).send("ContactID is missing");
    }

    const uniqueString = `${PaymentID}-${Date.now()}-${Math.random()}`;
    const hash = crypto.createHash("sha256").update(uniqueString).digest("hex");
    const qrCodeUrl = await generateAndUploadQRCode(hash);

    const addQRlinkToContactResponse = await addQRlinkToContact(
      contactId,
      qrCodeUrl
    );
    const addTagToContactResponse = await addTagToContact(contactId, 801066);

    const response = {
      PaymentID,
      uniqueID: hash,
      qrCodeUrl,
      addQRlinkToContactResponse,
      addTagToContactResponse,
    };

    res.json(response);
  } catch (error) {
    console.error("Error processing your request:", error);
    res.status(500).send("Error processing your request");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
