# Email Notification Setup Guide

## Issue
After successful payment, booking confirmation emails were not being sent to users due to:
1. PDF generation error (FIXED ✅)
2. Missing Resend email configuration (NEEDS SETUP ⚠️)

## What Was Fixed
- ✅ Added proper PDF margins to prevent rendering errors
- ✅ Added error handling so emails can be sent even if PDF generation fails
- ✅ Added success/failure logging for easier debugging

## Required: Email Configuration

### Step 1: Sign Up for Resend
1. Go to [https://resend.com](https://resend.com)
2. Create a free account (includes 100 emails/day for free)
3. Verify your email address

### Step 2: Get Your API Key
1. Log in to Resend dashboard
2. Go to **API Keys** section
3. Click **Create API Key**
4. Copy your API key (starts with `re_...`)

### Step 3: Configure Environment Variables

Create a `.env` file in the `backend/` directory with the following:

```env
# Resend Email Configuration
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM=onboarding@resend.dev

# Other required variables (you should already have these)
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_key
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
FRONTEND_URL=http://localhost:3000
```

### Step 4: (Optional) Use a Custom Domain
If you want to send emails from your own domain:
1. In Resend dashboard, go to **Domains**
2. Add your domain
3. Configure DNS records as shown
4. Update `RESEND_FROM` to use your domain (e.g., `booking@yourdomain.com`)

## Testing

After configuration, test the email system:

1. Make a test booking and complete payment
2. Check the backend logs for:
   ```
   Successfully sent booking confirmation email for {booking_id} to {email}
   ```
3. Check the recipient's email inbox (and spam folder)

## Troubleshooting

### "Resend not configured" message
- Make sure `RESEND_API_KEY` and `RESEND_FROM` are set in your `.env` file
- Restart the backend server after adding environment variables

### "Failed to send booking confirmation email"
- Check that your Resend API key is valid
- Verify the sender email is verified in Resend
- Check the backend logs for detailed error messages

### PDF still failing
- Check logs for specific PDF errors
- Email will still be sent without PDF attachment
- PDF generation is optional and won't prevent email delivery

## Email Content

The confirmation email includes:
- ✅ Booking details (space, date, time, attendees)
- ✅ Total amount paid
- ✅ Booking ID
- ✅ QR code for check-in (embedded in HTML)
- ✅ Check-in link
- ✅ PDF invoice attachment (if generation succeeds)

## Technical Details

### Email Triggers
Emails are sent automatically after:
1. **Stripe webhook** receives `checkout.session.completed` event
2. **Reconcile endpoint** confirms payment (backup if webhook missed)

### Idempotency
- The system prevents duplicate emails by checking `payment.receipt_url`
- Once sent, the field is marked as `"email_sent"`

### Dependencies
Make sure these packages are installed:
```bash
pip install resend fpdf segno
```

## Questions?

If you encounter issues:
1. Check backend logs for error messages
2. Verify all environment variables are set
3. Test Resend API key with a simple test script
4. Check Stripe webhook logs to ensure events are received

---

**Note:** With the free Resend plan, you get 100 emails per day. Upgrade if you need more.







