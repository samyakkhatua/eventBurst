const express = require('express');
const qr = require('qr-image');
const bodyParser = require('body-parser');
const cloudinary = require('./cloudinaryConfig'); 
const crypto = require('crypto').webcrypto; 

const app = express();
const port = 3000;

app.use(bodyParser.json());

async function generateAndUploadQRCode(uniqueID) {
  const pngBuffer = qr.imageSync(uniqueID, { type: 'png' });
  const imageBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(imageBase64);
  return result.url; 
}

app.post('/ticket', async (req, res) => {
  try {
    const { PaymentID } = req.body;

    if (!PaymentID) {
      return res.status(400).send('PaymentID is missing');
    }

    const uniqueString = `${PaymentID}-${Date.now()}-${Math.random()}`;
    const hash = crypto.createHash('sha256').update(uniqueString).digest('hex');
    const qrCodeUrl = await generateAndUploadQRCode(hash);

    const response = {
      PaymentID,
      uniqueID: hash,
      qrCodeUrl
    };

    res.json(response);
  } catch (error) {
    console.error('Error processing your request:', error);
    res.status(500).send('Error processing your request');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});