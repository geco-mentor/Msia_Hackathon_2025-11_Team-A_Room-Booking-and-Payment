import express from 'express';
const router = express.Router();

router.get("/payment-success", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Successful - Infinity8</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Helvetica Neue', Arial, sans-serif; 
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container { 
                    background: white;
                    padding: 60px 40px;
                    border-radius: 20px;
                    max-width: 600px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    border-top: 5px solid #C9A961;
                }
                .logo { width: 300px; margin-bottom: 20px; }
                .success-icon {
                    width: 80px; height: 80px;
                    background: #C9A961;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 30px;
                }
                .checkmark { font-size: 50px; color: white; }
                h1 { color: #C9A961; font-size: 32px; margin-bottom: 15px; font-weight: bold; }
                p { color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 15px; }
                .highlight { color: #1a1a1a; font-weight: bold; }
                .info-box {
                    background: #f8f8f8;
                    border-left: 4px solid #C9A961;
                    padding: 20px;
                    margin: 30px 0;
                    text-align: left;
                }
                .info-box p { margin: 8px 0; font-size: 14px; }
                .gold-bar {
                    height: 3px;
                    background: linear-gradient(90deg, #DAA520, #C9A961, #DAA520);
                    margin: 30px 0;
                }
                .footer { margin-top: 30px; font-size: 12px; color: #999; }
            </style>
        </head>
        <body>
            <div class="container">
                <img src="https://i.imgur.com/F9gH7rt.png" alt="Infinity8" class="logo">
                <div class="success-icon"><span class="checkmark">✓</span></div>
                <h1>Payment Successful!</h1>
                <p>Your booking has been <span class="highlight">confirmed</span></p>
                <div class="gold-bar"></div>
                <div class="info-box">
                    <p><strong>📱 WhatsApp Confirmation</strong></p>
                    <p>You'll receive a detailed confirmation message with your PDF invoice on WhatsApp shortly.</p>
                </div>
                <div class="info-box">
                    <p><strong>📋 What's Next?</strong></p>
                    <p>• Check your WhatsApp for booking details</p>
                    <p>• Save your PDF invoice for your records</p>
                    <p>• Arrive 10 minutes early on your booking day</p>
                </div>
                <div class="gold-bar"></div>
                <p class="footer">
                    You can safely close this window<br>
                    Questions? Contact us at hello@infinity8.co
                </p>
            </div>
        </body>
        </html>
    `);
});

router.get("/payment-cancel", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Cancelled - Infinity8</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Helvetica Neue', Arial, sans-serif; 
                    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container { 
                    background: white;
                    padding: 60px 40px;
                    border-radius: 20px;
                    max-width: 600px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    border-top: 5px solid #999;
                }
                .logo { width: 200px; margin-bottom: 30px; }
                .cancel-icon {
                    width: 80px; height: 80px;
                    background: #666;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 30px;
                }
                .cross { font-size: 50px; color: white; }
                h1 { color: #666; font-size: 32px; margin-bottom: 15px; font-weight: bold; }
                p { color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 15px; }
                .info-box {
                    background: #f8f8f8;
                    border-left: 4px solid #C9A961;
                    padding: 20px;
                    margin: 30px 0;
                    text-align: left;
                }
                .info-box p { margin: 8px 0; font-size: 14px; }
                .gold-bar {
                    height: 3px;
                    background: linear-gradient(90deg, #DAA520, #C9A961, #DAA520);
                    margin: 30px 0;
                }
                .btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #DAA520, #C9A961);
                    color: white;
                    padding: 15px 40px;
                    text-decoration: none;
                    border-radius: 30px;
                    font-weight: bold;
                    margin-top: 20px;
                    transition: transform 0.2s;
                }
                .btn:hover { transform: translateY(-2px); }
                .footer { margin-top: 30px; font-size: 12px; color: #999; }
            </style>
        </head>
        <body>
            <div class="container">
                <img src="https://i.imgur.com/F9gH7rt.png" alt="Infinity8" class="logo">
                <div class="cancel-icon"><span class="cross">✕</span></div>
                <h1>Payment Cancelled</h1>
                <p>No worries! Your booking reservation has been released.</p>
                <div class="gold-bar"></div>
                <div class="info-box">
                    <p><strong>🔄 Want to try again?</strong></p>
                    <p>Simply message us again on WhatsApp and we'll help you book your perfect workspace!</p>
                </div>
                <div class="info-box">
                    <p><strong>💡 Need Help?</strong></p>
                    <p>• Questions about pricing? Just ask!</p>
                    <p>• Need a different date/time? We're flexible</p>
                    <p>• Payment issues? We're here to help</p>
                </div>
                <a href="https://wa.me/14155238886" class="btn">Message Us on WhatsApp</a>
                <div class="gold-bar"></div>
                <p class="footer">
                    You can safely close this window<br>
                    Questions? Contact us at hello@infinity8.co
                </p>
            </div>
        </body>
        </html>
    `);
});

export default router;