const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendWhatsApp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated'
    );
  }

  const { recipients, message } = data;
  
  // Using WhatsApp Cloud API (free tier)
  const sendMessage = async (phoneNumber) => {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: { body: message }
          }),
        }
      );
      return response.json();
    } catch (error) {
      console.error(`Error sending to ${phoneNumber}:`, error);
      return { error: error.message };
    }
  };

  try {
    const results = await Promise.all(
      recipients.map(r => sendMessage(r.number))
    );
    return { success: true, results };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
}); 