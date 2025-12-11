import express from "express";
import bodyParser from "body-parser";
import twilio from "twilio";
import OpenAI from "openai";
import dotenv from "dotenv";
import Stripe from "stripe";
import mongoose from "mongoose";
import { systemPrompt, defaultUserPrompt } from "./prompts.js";
import { generateInvoicePDF, invoicesDir } from "./invoiceGenerator.js";
import paymentRoutes from './paymentPages.js';

dotenv.config();

const app = express();

// MongoDB Connection
mongoose
    .connect(process.env.MONGO_DB, { dbName: "testbot" })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

// Room Model
const roomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    seats: { type: Number, required: true },
    projector: { type: Boolean, required: true },
});

const Room = mongoose.model("Room", roomSchema, "rooms");

// Booking Model (Enhanced with refund fields and add-ons)
const bookingSchema = new mongoose.Schema({
    whatsappNumber: { type: String, required: true },
    userName: { type: String, default: "" },
    roomName: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    status: {
        type: String,
        enum: ["pending", "completed", "cancelled", "refunded"],
        default: "pending",
    },
    // Add-ons stored as array of strings like ["projector x2", "chairs x5"]
    adds: { type: [String], default: [] },
    paymentSessionId: String,
    paymentIntentId: String,
    invoiceNumber: String,
    amountPaid: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    refundId: String,
    cancellationReason: String,
    cancelledAt: Date,
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
});

bookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Booking = mongoose.model("Booking", bookingSchema, "bookings");

// Initialize Services
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(bodyParser.urlencoded({ extended: false }));
app.use("/stripe-webhook", express.raw({ type: "application/json" }));
app.use(express.json()); // For cancel endpoint

// Serve invoices directory
app.use('/invoices', express.static(invoicesDir));

// In-memory conversation store
const conversations = {};

// Booking timeout (30 minutes - Stripe minimum)
const BOOKING_TIMEOUT_MS = 30 * 60 * 1000;

// Cancellation policy constant
const CANCELLATION_HOURS_REQUIRED = 24;

// Add-on pricing (per hour)
const ADDON_PRICES = {
    projector: 50,
    lcdScreen: 100,
    chairs: 10  // per chair per hour
};

// Auto-cancel expired bookings every minute
setInterval(async () => {
    try {
        const now = new Date();
        const result = await Booking.updateMany(
            { status: "pending", expiresAt: { $lt: now } },
            { $set: { status: "cancelled" } }
        );
        if (result.modifiedCount > 0) {
            console.log(`⏰ Auto-cancelled ${result.modifiedCount} expired booking(s)`);
        }
    } catch (err) {
        console.error("❌ Error auto-cancelling bookings:", err);
    }
}, 60000);

// Helper: Check if user has pending bookings
const getUserPendingBookings = async (whatsappNumber) => {
    return await Booking.find({
        whatsappNumber: whatsappNumber.replace("whatsapp:", ""),
        status: "pending"
    });
};

// Helper: Convert 24-hour time to 12-hour format with AM/PM
const convertTo12Hour = (time24) => {
    const [start, end] = time24.split('-');
    
    const convert = (time) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${hour12}:${minutes} ${ampm}`;
    };
    
    return `${convert(start)} - ${convert(end)}`;
};

// Helper: Format date to DD/MM/YYYY
const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// Helper: Calculate booking duration in hours
const calculateDuration = (timeRange) => {
    const [start, end] = timeRange.split('-');
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    const durationMinutes = endMinutes - startMinutes;
    const durationHours = durationMinutes / 60;
    
    return durationHours;
};

// Helper: Check if booking can be cancelled with refund
const canCancelWithRefund = (bookingDateTime) => {
    const now = new Date();
    const bookingTime = new Date(bookingDateTime);
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);
    
    return hoursUntilBooking >= CANCELLATION_HOURS_REQUIRED;
};

// Helper: Process refund via Stripe
const processRefund = async (paymentIntentId, refundAmount, reason) => {
    try {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: Math.round(refundAmount * 100), // Convert to cents
            reason: 'requested_by_customer', // Stripe only accepts: duplicate, fraudulent, requested_by_customer
            metadata: {
                refund_reason: reason || 'Customer requested cancellation'
            }
        });
        
        return {
            success: true,
            refundId: refund.id,
            amount: refund.amount / 100,
            status: refund.status
        };
    } catch (error) {
        console.error("❌ Refund error:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Helper: Format booking for display
const formatBookingForDisplay = (booking, index) => {
    const [startTime] = booking.time.split('-');
    const bookingDateTime = `${booking.date}T${startTime}:00+08:00`;
    const eligibleForRefund = canCancelWithRefund(bookingDateTime);
    
    let display = `${index}. Room ${booking.roomName}\n`;
    display += `   📅 ${formatDate(booking.date)} at ${convertTo12Hour(booking.time)}\n`;
    
    if (booking.status === "completed") {
        display += `   💰 Paid: MYR ${booking.amountPaid.toFixed(2)}\n`;
        display += `   ${eligibleForRefund ? '✅ Full refund available' : '❌ No refund (less than 24h)'}\n`;
    } else {
        display += `   ⏳ Payment pending\n`;
    }
    
    return display;
};

// Helper: Cancel a booking
const cancelBooking = async (booking, reason = "") => {
    const userNumber = booking.whatsappNumber;
    
    // Pending booking - cancel it and expire Stripe session
    if (booking.status === "pending") {
        // Expire the Stripe checkout session if it exists
        if (booking.paymentSessionId) {
            try {
                console.log(`🔒 Attempting to expire Stripe session: ${booking.paymentSessionId}`);
                const expiredSession = await stripe.checkout.sessions.expire(booking.paymentSessionId);
                console.log(`✅ Successfully expired Stripe session: ${booking.paymentSessionId}, Status: ${expiredSession.status}`);
            } catch (stripeErr) {
                console.error("⚠️ Could not expire Stripe session:", stripeErr.message);
                console.error("Full error:", stripeErr);
                // Continue with cancellation even if Stripe expiry fails
            }
        } else {
            console.log(`⚠️ No payment session ID found for booking ${booking._id}`);
        }

        booking.status = "cancelled";
        booking.cancellationReason = reason || "Cancelled before payment";
        booking.cancelledAt = new Date();
        await booking.save();

        console.log(`✅ Booking ${booking._id} status set to cancelled`);

        const msg = `✅ Got it! I've cancelled your pending booking.\n\n📍 Room ${booking.roomName}\n📅 ${formatDate(booking.date)} at ${convertTo12Hour(booking.time)}\n\nNo worries, feel free to book again whenever you're ready! 😊`;

        return { success: true, message: msg, refunded: false, sendMessage: true };
    }

    // Completed booking - check refund eligibility
    if (booking.status === "completed") {
        const [startTime] = booking.time.split('-');
        const bookingDateTime = `${booking.date}T${startTime}:00+08:00`;
        const eligibleForRefund = canCancelWithRefund(bookingDateTime);

        if (!eligibleForRefund) {
            // No refund
            booking.status = "cancelled";
            booking.cancellationReason = reason || "Cancelled less than 24 hours before booking";
            booking.cancelledAt = new Date();
            await booking.save();

            const msg = `Alright, I've cancelled your booking, but unfortunately there's no refund since it's less than 24 hours away. 😔\n\n📍 Room ${booking.roomName}\n📅 ${formatDate(booking.date)} at ${convertTo12Hour(booking.time)}\n💰 Original payment: MYR ${booking.amountPaid.toFixed(2)}\n\nOur policy requires 24 hours notice for refunds. Thanks for understanding!`;

            return { success: true, message: msg, refunded: false, sendMessage: true };
        }

        // Full refund
        const refundAmount = booking.amountPaid;
        const refundResult = await processRefund(
            booking.paymentIntentId,
            refundAmount,
            reason // This goes to metadata, not Stripe's reason parameter
        );

        if (!refundResult.success) {
            throw new Error(`Refund failed: ${refundResult.error}`);
        }

        booking.status = "refunded";
        booking.refundId = refundResult.refundId;
        booking.refundAmount = refundAmount;
        booking.cancellationReason = reason || "Customer requested cancellation";
        booking.cancelledAt = new Date();
        await booking.save();

        const msg = `✅ All done! Your booking is cancelled and you'll get a full refund of MYR ${refundAmount.toFixed(2)}.\n\n📍 Room ${booking.roomName}\n📅 ${formatDate(booking.date)} at ${convertTo12Hour(booking.time)}\n💵 Refund: MYR ${refundAmount.toFixed(2)}\n\nThe money should be back in your account within 5-10 business days. See you again soon! 😊`;

        return { success: true, message: msg, refunded: true, refundAmount, sendMessage: true };
    }

    throw new Error("Invalid booking status");
};

// Helper: Get current date in Malaysia timezone
const getCurrentDateMY = () => {
    const now = new Date();
    const malaysiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    return malaysiaTime.toISOString().split('T')[0];
};

// Helper: Calculate relative dates accurately
const calculateRelativeDate = (relativeTerm, currentDate) => {
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const [year, month, day] = currentDate.split('-').map(Number);
    const today = new Date(year, month - 1, day);
    const todayDayOfWeek = today.getDay();

    const lowerTerm = relativeTerm.toLowerCase();

    if (lowerTerm.includes('tomorrow')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const y = tomorrow.getFullYear();
        const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const d = String(tomorrow.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const nextDayMatch = lowerTerm.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (nextDayMatch) {
        const targetDay = nextDayMatch[1];
        const targetDayIndex = daysOfWeek.indexOf(targetDay);
        let daysUntil = targetDayIndex - todayDayOfWeek;
        if (daysUntil <= 0) {
            daysUntil += 7;
        }
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + daysUntil);
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const thisDayMatch = lowerTerm.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (thisDayMatch) {
        const targetDay = thisDayMatch[1];
        const targetDayIndex = daysOfWeek.indexOf(targetDay);
        let daysUntil = targetDayIndex - todayDayOfWeek;
        if (daysUntil <= 0) {
            daysUntil += 7;
        }
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + daysUntil);
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return null;
};

const validateDate = (dateStr) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
        return { valid: false, error: "Invalid date format" };
    }

    const bookingDate = new Date(dateStr + 'T00:00:00+08:00');
    const today = new Date(getCurrentDateMY() + 'T00:00:00+08:00');

    if (bookingDate < today) {
        return { valid: false, error: "Cannot book dates in the past" };
    }

    return { valid: true };
};

const validateTime = (timeStr, dateStr) => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeStr)) {
        return { valid: false, error: "Invalid time format" };
    }

    const [start, end] = timeStr.split('-');
    if (start >= end) {
        return { valid: false, error: "End time must be after start time" };
    }

    const today = getCurrentDateMY();
    if (dateStr === today) {
        const now = new Date();
        const malaysiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
        const currentHour = malaysiaTime.getHours();
        const currentMinute = malaysiaTime.getMinutes();
        const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

        if (start <= currentTimeStr) {
            return { valid: false, error: "Cannot book times in the past" };
        }
    }

    return { valid: true };
};

const getRoomsData = async () => {
    try {
        return await Room.find().lean() || [];
    } catch (err) {
        console.error("❌ Error fetching rooms:", err);
        return [];
    }
};

const checkBookingConflict = async (roomName, date, time) => {
    const [requestStart, requestEnd] = time.split('-');

    const existingBookings = await Booking.find({
        roomName: roomName,
        date: date,
        status: { $in: ["pending", "completed"] }
    });

    for (const booking of existingBookings) {
        if (booking.status === "pending" && new Date() > new Date(booking.expiresAt)) {
            booking.status = "cancelled";
            await booking.save();
            continue;
        }

        const [existingStart, existingEnd] = booking.time.split('-');
        const overlap = (requestStart < existingEnd && requestEnd > existingStart);

        if (overlap) {
            return booking;
        }
    }

    return null;
};

// Helper: Create booking with add-ons
const createBookingWithAddons = async (bookingData, addOnsArray, fromNumber, profileName, twiml, res) => {
    const { roomName, date, time, roomPrice, duration } = bookingData;
    
    // Calculate room price based on duration (price per hour)
    const roomTotalPrice = roomPrice * duration;
    let totalPrice = roomTotalPrice;
    let addOnDetails = [];
    
    // Calculate add-on costs based on duration
    addOnsArray.forEach(addon => {
        const [item, qtyStr] = addon.split(' x');
        const qty = parseInt(qtyStr);
        
        if (item === 'projector') {
            const cost = qty * ADDON_PRICES.projector * duration;
            totalPrice += cost;
            addOnDetails.push(`${qty}x Projector (MYR ${cost.toFixed(2)})`);
        } else if (item === 'lcdScreen') {
            const cost = qty * ADDON_PRICES.lcdScreen * duration;
            totalPrice += cost;
            addOnDetails.push(`${qty}x LCD Screen (MYR ${cost.toFixed(2)})`);
        } else if (item === 'chairs') {
            const cost = qty * ADDON_PRICES.chairs * duration;
            totalPrice += cost;
            addOnDetails.push(`${qty}x Extra Chairs (MYR ${cost.toFixed(2)})`);
        }
    });
    
    const expiresAt = new Date(Date.now() + BOOKING_TIMEOUT_MS);

    const booking = new Booking({
        whatsappNumber: fromNumber.replace("whatsapp:", ""),
        userName: profileName,
        roomName: roomName,
        date,
        time,
        status: "pending",
        amountPaid: totalPrice,
        adds: addOnsArray, // Store as array of strings: ["projector x2", "chairs x5"]
        expiresAt: expiresAt
    });

    await booking.save();

    let description = `Booking Room ${roomName} on ${date} at ${time} (${duration}h)`;
    if (addOnDetails.length > 0) {
        description += ` + ${addOnDetails.join(', ')}`;
    }

    const paymentSession = await createCheckoutSession(
        totalPrice,
        description,
        fromNumber,
        booking._id
    );

    // Save the session ID properly
    booking.paymentSessionId = paymentSession.sessionId;
    await booking.save();
    
    console.log(`💳 Created Stripe session: ${paymentSession.sessionId}`);

    const timeoutMinutes = BOOKING_TIMEOUT_MS / 1000 / 60;
    const expiryTime = new Date(Date.now() + BOOKING_TIMEOUT_MS);
    const expiryTimeStr = expiryTime.toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    // Send reminder after 20 minutes (10 minutes before expiry)
    setTimeout(async () => {
        try {
            const currentBooking = await Booking.findById(booking._id);
            if (currentBooking && currentBooking.status === "pending") {
                const reminderMsg = `⏰ Reminder: Your booking reservation expires in 10 minutes!\n\n📍 Room ${roomName}\n📅 ${formatDate(date)} at ${convertTo12Hour(time)}\n\nComplete payment now:\n${paymentSession.url}`;
                
                await client.messages.create({
                    from: "whatsapp:+14155238886",
                    to: fromNumber,
                    body: reminderMsg,
                });
                console.log(`⏰ Sent 10-minute reminder for booking ${booking._id}`);
            }
        } catch (err) {
            console.error("❌ Error sending reminder:", err);
        }
    }, 20 * 60 * 1000); // 20 minutes

    let responseMsg = `Awesome! 🎉 Got your booking:\n\n📍 Room ${roomName}\n📅 ${formatDate(date)}\n⏰ ${convertTo12Hour(time)} (${duration}h)`;
    
    if (addOnDetails.length > 0) {
        responseMsg += `\n\n➕ Add-ons:\n`;
        addOnsArray.forEach(addon => {
            const [item, qtyStr] = addon.split(' x');
            const qty = parseInt(qtyStr);
            let itemName = item === 'projector' ? '📽️ Projector' : 
                          item === 'lcdScreen' ? '🖥️ LCD Screen' : 
                          '🪑 Chairs';
            responseMsg += `   ${itemName} x${qty}\n`;
        });
    }
    
    responseMsg += `\n💰 Total: MYR ${totalPrice.toFixed(2)}`;
    responseMsg += `\n\n🔗 Complete payment here (expires in ${timeoutMinutes} min):\n${paymentSession.url}`;
    responseMsg += `\n\n⚠️ Book expires at ${expiryTimeStr} if not paid`;
    responseMsg += `\n💡 I'll remind you 10 min before!`;
    
    console.log(`✅ Booking created successfully - sending payment link`);
    twiml.message(responseMsg);

    return res.type("text/xml").send(twiml.toString());
};

const createCheckoutSession = async (amount, description, whatsappNumber, bookingId) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "myr",
                        product_data: {
                            name: description,
                            description: "Infinity8 Coworking Space - Meeting Room Booking",
                            images: ["https://i.imgur.com/F9gH7rt.png"],
                        },
                        unit_amount: amount * 100,
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: `${process.env.BASE_URL}/payment-success`,
            cancel_url: `${process.env.BASE_URL}/payment-cancel`,
            metadata: {
                whatsappNumber: whatsappNumber.replace("whatsapp:", ""),
                bookingId: bookingId.toString()
            },
            expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
            
            // Terms & Conditions
            consent_collection: {
                terms_of_service: 'required'
            },
            
            custom_text: {
                submit: {
                    message: "Complete your booking with Infinity8"
                },
                terms_of_service_acceptance: {
                    message: "I agree to arrive 10 minutes early, understand the 24-hour cancellation policy for full refunds, and accept all terms and conditions."
                },
                after_submit: {
                    message: "Your booking is being processed. You'll receive a confirmation via WhatsApp shortly!"
                }
            },
            
            billing_address_collection: "auto",
            
            invoice_creation: {
                enabled: true,
                invoice_data: {
                    description: `Room booking for ${description}`,
                    footer: "Thank you for choosing Infinity8 Coworking Space!",
                    metadata: {
                        booking_id: bookingId.toString()
                    }
                }
            }
        });

        return {
            url: session.url,
            sessionId: session.id
        };
    } catch (err) {
        console.error("❌ Error creating Stripe session:", err);
        throw err;
    }
};

// NEW: Cancel Booking Endpoint (kept for web interface if needed)
app.post("/cancel-booking", async (req, res) => {
    try {
        const { bookingId, whatsappNumber, reason } = req.body;

        if (!bookingId || !whatsappNumber) {
            return res.status(400).json({ 
                success: false, 
                error: "Missing bookingId or whatsappNumber" 
            });
        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ 
                success: false, 
                error: "Booking not found" 
            });
        }

        if (booking.whatsappNumber !== whatsappNumber.replace("whatsapp:", "")) {
            return res.status(403).json({ 
                success: false, 
                error: "Unauthorized: This booking doesn't belong to you" 
            });
        }

        if (booking.status === "cancelled" || booking.status === "refunded") {
            return res.status(400).json({ 
                success: false, 
                error: `Booking already ${booking.status}` 
            });
        }

        const result = await cancelBooking(booking, reason);
        
        // Send WhatsApp notification if needed
        if (result.sendMessage) {
            client.messages
                .create({
                    from: "whatsapp:+14155238886",
                    to: "whatsapp:" + booking.whatsappNumber,
                    body: result.message,
                })
                .then(msg => console.log("✅ Cancellation notification sent:", msg.sid))
                .catch(err => console.error("❌ Failed to send cancellation notification:", err));
        }
        
        return res.json(result);

    } catch (error) {
        console.error("❌ Error cancelling booking:", error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// View user's bookings
app.get("/my-bookings/:whatsappNumber", async (req, res) => {
    try {
        const whatsappNumber = req.params.whatsappNumber.replace("whatsapp:", "");
        
        const bookings = await Booking.find({ 
            whatsappNumber: whatsappNumber,
            status: { $in: ["pending", "completed"] }
        }).sort({ createdAt: -1 });

        const bookingsWithRefundInfo = bookings.map(booking => {
            const [startTime] = booking.time.split('-');
            const bookingDateTime = `${booking.date}T${startTime}:00+08:00`;
            const eligibleForRefund = canCancelWithRefund(bookingDateTime);
            
            return {
                ...booking.toObject(),
                cancellationPolicy: {
                    eligibleForRefund,
                    canCancel: true,
                    refundAmount: booking.status === "completed" && eligibleForRefund
                        ? booking.amountPaid.toFixed(2)
                        : "0.00",
                    message: eligibleForRefund 
                        ? "100% refund available" 
                        : "No refund - less than 24 hours"
                }
            };
        });

        res.json({ 
            success: true, 
            count: bookingsWithRefundInfo.length, 
            bookings: bookingsWithRefundInfo 
        });
    } catch (error) {
        console.error("❌ Error fetching bookings:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// WhatsApp Webhook (Enhanced with natural cancellation flow)
app.post("/whatsapp", async (req, res) => {
    const incomingMsg = req.body.Body?.trim();
    const fromNumber = req.body.From;
    const profileName = req.body.ProfileName || "User";
    const twiml = new twilio.twiml.MessagingResponse();

    console.log(`\n📨 Incoming WhatsApp: "${incomingMsg}" from ${fromNumber}`);

    if (!incomingMsg || !fromNumber) {
        twiml.message("Sorry, I didn't receive your message properly. Please try again.");
        return res.type("text/xml").send(twiml.toString());
    }

    try {
        const userNumber = fromNumber.replace("whatsapp:", "");
        const lowerMsg = incomingMsg.toLowerCase();

        // Check conversation state
        const hasConversation = conversations[fromNumber]?.length > 0;
        const lastMsg = hasConversation ? conversations[fromNumber][conversations[fromNumber].length - 1] : null;
        console.log(`💬 Conversation state: ${hasConversation ? 'EXISTS' : 'NONE'}`);
        if (lastMsg) {
            console.log(`📝 Last message: ${lastMsg.content?.substring(0, 50)}...`);
        }

        // Handle cancellation requests
        if (lowerMsg.includes('cancel') || lowerMsg.includes('refund')) {
            console.log(`🚫 Cancel request detected`);
            const activeBookings = await Booking.find({
                whatsappNumber: userNumber,
                status: { $in: ["pending", "completed"] }
            }).sort({ createdAt: -1 });

            if (activeBookings.length === 0) {
                twiml.message("Looks like you don't have any active bookings right now. Want to make a new booking? 😊");
                return res.type("text/xml").send(twiml.toString());
            }

            if (activeBookings.length === 1) {
                // Show single booking and ask for confirmation
                const booking = activeBookings[0];
                const [startTime] = booking.time.split('-');
                const bookingDateTime = `${booking.date}T${startTime}:00+08:00`;
                const eligibleForRefund = canCancelWithRefund(bookingDateTime);
                
                let confirmMsg = `Are you sure you want to cancel this booking?\n\n`;
                confirmMsg += `📍 Room ${booking.roomName}\n`;
                confirmMsg += `📅 ${formatDate(booking.date)} at ${convertTo12Hour(booking.time)}\n`;
                
                if (booking.status === "completed") {
                    confirmMsg += `💰 Paid: MYR ${booking.amountPaid.toFixed(2)}\n\n`;
                    if (eligibleForRefund) {
                        confirmMsg += `✅ You'll get a FULL REFUND of MYR ${booking.amountPaid.toFixed(2)}\n\n`;
                    } else {
                        confirmMsg += `❌ NO REFUND (less than 24 hours to booking time)\n\n`;
                    }
                } else {
                    confirmMsg += `⏳ Payment pending - No charges\n\n`;
                }
                
                confirmMsg += `Reply "YES" to confirm cancellation or "NO" to keep your booking.`;
                
                twiml.message(confirmMsg);
                
                // Store context for confirmation
                conversations[fromNumber] = conversations[fromNumber] || [];
                conversations[fromNumber].push({
                    role: "system",
                    content: `CONFIRM_CANCEL:${booking._id}`
                });
                
                return res.type("text/xml").send(twiml.toString());
            }

            // Multiple bookings - show list
            let bookingsList = "You have multiple bookings. Which one do you want to cancel?\n\n";
            activeBookings.forEach((booking, index) => {
                bookingsList += formatBookingForDisplay(booking, index + 1);
                bookingsList += "\n";
            });
            
            if (activeBookings.length === 2) {
                bookingsList += "\nReply with:\n• The number (1 or 2)\n• 'BOTH' to cancel both bookings";
            } else {
                bookingsList += "\nReply with:\n• The number to cancel one booking\n• 'ALL' to cancel all bookings";
            }

            twiml.message(bookingsList);
            
            // Store context for next message
            conversations[fromNumber] = conversations[fromNumber] || [];
            conversations[fromNumber].push({
                role: "system",
                content: `SELECT_BOOKING:${activeBookings.map(b => b._id).join(',')}`
            });

            return res.type("text/xml").send(twiml.toString());
        }

        // Check if waiting for cancellation confirmation (YES/NO)
        if (conversations[fromNumber]?.length > 0) {
            const lastMsg = conversations[fromNumber][conversations[fromNumber].length - 1];
            
            console.log(`🔎 Checking conversation context...`);
            
            // Handle add-on selection - NATURAL CONVERSATION
            if (lastMsg.content?.startsWith('AWAITING_ADDONS:')) {
                const bookingData = JSON.parse(lastMsg.content.replace('AWAITING_ADDONS:', ''));
                const userInput = incomingMsg.trim().toLowerCase();
                
                // Handle NO
                if (userInput.includes('no') || userInput.includes('nope') || userInput.includes('nah') || 
                    userInput.includes('none') || userInput.includes('nothing') || userInput === 'n') {
                    await createBookingWithAddons(bookingData, [], fromNumber, profileName, twiml, res);
                    return;
                }
                
                // Parse what they want naturally
                let wantsProjector = userInput.includes('projector') || userInput.includes('1');
                let wantsLCD = userInput.includes('lcd') || userInput.includes('screen') || userInput.includes('2');
                let wantsChairs = userInput.includes('chair') || userInput.includes('3');
                let wantsAll = userInput.includes('all') || userInput.includes('everything');
                
                if (wantsAll) {
                    wantsProjector = wantsLCD = wantsChairs = true;
                }
                
                if (!wantsProjector && !wantsLCD && !wantsChairs) {
                    twiml.message(`Didn't catch that! Just tell me what you need like "projector" or "chairs" or say "no" if nothing 😊`);
                    return res.type("text/xml").send(twiml.toString());
                }
                
                // Store what they want and ask for quantity
                let selectedItems = [];
                if (wantsProjector) selectedItems.push('projector');
                if (wantsLCD) selectedItems.push('lcdScreen');
                if (wantsChairs) selectedItems.push('chairs');
                
                // Ask for quantity naturally
                if (selectedItems.length === 1) {
                    const itemName = selectedItems[0] === 'projector' ? 'projector' : 
                                    selectedItems[0] === 'lcdScreen' ? 'LCD screen' : 'chairs';
                    twiml.message(`Cool! How many ${itemName}${selectedItems[0] === 'chairs' ? '' : 's'} do you need?`);
                } else {
                    let qtyMsg = `Got it! How many of each?\n`;
                    selectedItems.forEach(item => {
                        if (item === 'projector') qtyMsg += `Projector: ?\n`;
                        if (item === 'lcdScreen') qtyMsg += `LCD Screen: ?\n`;
                        if (item === 'chairs') qtyMsg += `Chairs: ?\n`;
                    });
                    twiml.message(qtyMsg);
                }
                
                conversations[fromNumber] = conversations[fromNumber].filter(
                    msg => !msg.content?.startsWith('AWAITING_ADDONS:')
                );
                conversations[fromNumber].push({
                    role: "system",
                    content: `AWAITING_ADDON_QTY:${JSON.stringify({...bookingData, items: selectedItems})}`
                });
                
                return res.type("text/xml").send(twiml.toString());
            }
            
            // Handle add-on quantity - NATURAL CONVERSATION
            if (lastMsg.content?.startsWith('AWAITING_ADDON_QTY:')) {
                const data = JSON.parse(lastMsg.content.replace('AWAITING_ADDON_QTY:', ''));
                const userInput = incomingMsg.trim().toLowerCase();
                
                let addOns = [];
                
                // Try to extract quantities naturally
                const numbers = userInput.match(/\d+/g);
                
                if (data.items.length === 1 && numbers && numbers.length === 1) {
                    // Single item, single number - got the quantity!
                    const qty = parseInt(numbers[0]);
                    if (qty > 0 && qty <= 50) {
                        addOns.push(`${data.items[0]} x${qty}`);
                        
                        // Now ask if they want anything else!
                        let remainingItems = [];
                        if (!data.items.includes('projector')) remainingItems.push('Projector');
                        if (!data.items.includes('lcdScreen')) remainingItems.push('LCD Screen');
                        if (!data.items.includes('chairs')) remainingItems.push('Chairs');
                        
                        if (remainingItems.length > 0) {
                            twiml.message(`Got it! Want anything else? We still have:\n• ${remainingItems.join('\n• ')}\n\nOr say "no" if you're good!`);
                            
                            conversations[fromNumber] = conversations[fromNumber].filter(
                                msg => !msg.content?.startsWith('AWAITING_ADDON_QTY:')
                            );
                            conversations[fromNumber].push({
                                role: "system",
                                content: `AWAITING_MORE_ADDONS:${JSON.stringify({...data, currentAddons: addOns})}`
                            });
                            
                            return res.type("text/xml").send(twiml.toString());
                        }
                        
                        // No more items available, show summary and confirm
                    } else {
                        twiml.message(`That's quite a lot! Can you double check the quantity? 😅`);
                        return res.type("text/xml").send(twiml.toString());
                    }
                } else {
                    // Multiple items or complex input - parse smartly
                    const projectorMatch = userInput.match(/projector[:\s]*(\d+)|(\d+)\s*projector/i);
                    const lcdMatch = userInput.match(/lcd[:\s]*(\d+)|screen[:\s]*(\d+)|(\d+)\s*lcd|(\d+)\s*screen/i);
                    const chairsMatch = userInput.match(/chair[s]?[:\s]*(\d+)|(\d+)\s*chair/i);
                    
                    if (data.items.includes('projector')) {
                        if (projectorMatch) {
                            const qty = parseInt(projectorMatch[1] || projectorMatch[2]);
                            if (qty > 0) addOns.push(`projector x${qty}`);
                        }
                    }
                    
                    if (data.items.includes('lcdScreen')) {
                        if (lcdMatch) {
                            const qty = parseInt(lcdMatch[1] || lcdMatch[2] || lcdMatch[3] || lcdMatch[4]);
                            if (qty > 0) addOns.push(`lcdScreen x${qty}`);
                        }
                    }
                    
                    if (data.items.includes('chairs')) {
                        if (chairsMatch) {
                            const qty = parseInt(chairsMatch[1] || chairsMatch[2]);
                            if (qty > 0) addOns.push(`chairs x${qty}`);
                        }
                    }
                    
                    // Check if we got everything
                    if (addOns.length < data.items.length) {
                        let missingMsg = `Hmm, can you tell me the quantities again? Like:\n`;
                        data.items.forEach(item => {
                            if (item === 'projector') missingMsg += `Projector: 2\n`;
                            if (item === 'lcdScreen') missingMsg += `LCD Screen: 1\n`;
                            if (item === 'chairs') missingMsg += `Chairs: 5\n`;
                        });
                        twiml.message(missingMsg);
                        return res.type("text/xml").send(twiml.toString());
                    }
                }
                
                // Show summary and confirm
                let summaryMsg = `Perfect! Here's your booking:\n\n`;
                summaryMsg += `📍 Room ${data.roomName}\n`;
                summaryMsg += `📅 ${formatDate(data.date)}\n`;
                summaryMsg += `⏰ ${convertTo12Hour(data.time)} (${data.duration}h)\n`;
                
                if (addOns.length > 0) {
                    summaryMsg += `\n➕ Add-ons:\n`;
                    addOns.forEach(addon => {
                        const [item, qtyStr] = addon.split(' x');
                        const itemName = item === 'projector' ? '📽️ Projector' : 
                                        item === 'lcdScreen' ? '🖥️ LCD Screen' : '🪑 Chairs';
                        summaryMsg += `   ${itemName} x${qtyStr}\n`;
                    });
                }
                
                summaryMsg += `\nLooks good? Reply "YES" to confirm or "NO" to cancel.`;
                
                twiml.message(summaryMsg);
                
                conversations[fromNumber] = conversations[fromNumber].filter(
                    msg => !msg.content?.startsWith('AWAITING_ADDON_QTY:')
                );
                conversations[fromNumber].push({
                    role: "system",
                    content: `CONFIRM_BOOKING_WITH_ADDONS:${JSON.stringify({...data, addOns})}`
                });
                
                return res.type("text/xml").send(twiml.toString());
            }
            
            // Handle asking for more add-ons
            if (lastMsg.content?.startsWith('AWAITING_MORE_ADDONS:')) {
                const data = JSON.parse(lastMsg.content.replace('AWAITING_MORE_ADDONS:', ''));
                const userInput = incomingMsg.trim().toLowerCase();
                
                // Check if they want more
                if (userInput.includes('no') || userInput.includes('nope') || userInput.includes('nah') || 
                    userInput.includes('none') || userInput.includes('nothing') || userInput === 'n') {
                    
                    // Show summary and proceed
                    let summaryMsg = `Perfect! Here's your booking:\n\n`;
                    summaryMsg += `📍 Room ${data.roomName}\n`;
                    summaryMsg += `📅 ${formatDate(data.date)}\n`;
                    summaryMsg += `⏰ ${convertTo12Hour(data.time)} (${data.duration}h)\n`;
                    
                    if (data.currentAddons.length > 0) {
                        summaryMsg += `\n➕ Add-ons:\n`;
                        data.currentAddons.forEach(addon => {
                            const [item, qtyStr] = addon.split(' x');
                            const itemName = item === 'projector' ? '📽️ Projector' : 
                                            item === 'lcdScreen' ? '🖥️ LCD Screen' : '🪑 Chairs';
                            summaryMsg += `   ${itemName} x${qtyStr}\n`;
                        });
                    }
                    
                    summaryMsg += `\nLooks good? Reply "YES" to confirm or "NO" to cancel.`;
                    
                    twiml.message(summaryMsg);
                    
                    conversations[fromNumber] = conversations[fromNumber].filter(
                        msg => !msg.content?.startsWith('AWAITING_MORE_ADDONS:')
                    );
                    conversations[fromNumber].push({
                        role: "system",
                        content: `CONFIRM_BOOKING_WITH_ADDONS:${JSON.stringify({...data, addOns: data.currentAddons})}`
                    });
                    
                    return res.type("text/xml").send(twiml.toString());
                }
                
                // They want more - parse what
                let wantsProjector = !data.items.includes('projector') && (userInput.includes('projector') || userInput.includes('1'));
                let wantsLCD = !data.items.includes('lcdScreen') && (userInput.includes('lcd') || userInput.includes('screen') || userInput.includes('2'));
                let wantsChairs = !data.items.includes('chairs') && (userInput.includes('chair') || userInput.includes('3'));
                
                if (!wantsProjector && !wantsLCD && !wantsChairs) {
                    twiml.message(`Didn't catch that! Just tell me what else you need or say "no" 😊`);
                    return res.type("text/xml").send(twiml.toString());
                }
                
                let newItems = [];
                if (wantsProjector) newItems.push('projector');
                if (wantsLCD) newItems.push('lcdScreen');
                if (wantsChairs) newItems.push('chairs');
                
                // Ask for quantity
                if (newItems.length === 1) {
                    const itemName = newItems[0] === 'projector' ? 'projector' : 
                                    newItems[0] === 'lcdScreen' ? 'LCD screen' : 'chairs';
                    twiml.message(`Cool! How many ${itemName}${newItems[0] === 'chairs' ? '' : 's'}?`);
                } else {
                    let qtyMsg = `Got it! How many of each?\n`;
                    newItems.forEach(item => {
                        if (item === 'projector') qtyMsg += `Projector: ?\n`;
                        if (item === 'lcdScreen') qtyMsg += `LCD Screen: ?\n`;
                        if (item === 'chairs') qtyMsg += `Chairs: ?\n`;
                    });
                    twiml.message(qtyMsg);
                }
                
                conversations[fromNumber] = conversations[fromNumber].filter(
                    msg => !msg.content?.startsWith('AWAITING_MORE_ADDONS:')
                );
                conversations[fromNumber].push({
                    role: "system",
                    content: `AWAITING_ADDON_QTY:${JSON.stringify({...data, items: newItems})}`
                });
                
                return res.type("text/xml").send(twiml.toString());
            }
            
            // Handle final booking confirmation with add-ons
            if (lastMsg.content?.startsWith('CONFIRM_BOOKING_WITH_ADDONS:')) {
                const data = JSON.parse(lastMsg.content.replace('CONFIRM_BOOKING_WITH_ADDONS:', ''));
                const userResponse = incomingMsg.trim().toUpperCase();
                
                if (userResponse === 'YES' || userResponse === 'Y') {
                    conversations[fromNumber] = conversations[fromNumber].filter(
                        msg => !msg.content?.startsWith('CONFIRM_BOOKING_WITH_ADDONS:')
                    );
                    await createBookingWithAddons(data, data.addOns, fromNumber, profileName, twiml, res);
                    return;
                } else if (userResponse === 'NO' || userResponse === 'N') {
                    twiml.message("No worries! Let me know if you want to book later 😊");
                    conversations[fromNumber] = conversations[fromNumber].filter(
                        msg => !msg.content?.startsWith('CONFIRM_BOOKING_WITH_ADDONS:')
                    );
                    return res.type("text/xml").send(twiml.toString());
                } else {
                    twiml.message("Please reply 'YES' to confirm or 'NO' to cancel");
                    return res.type("text/xml").send(twiml.toString());
                }
            }
            
            // Handle multiple booking cancellation confirmation
            if (lastMsg.content?.startsWith('CONFIRM_CANCEL_MULTIPLE:')) {
                const bookingIds = lastMsg.content.replace('CONFIRM_CANCEL_MULTIPLE:', '').split(',');
                const userResponse = incomingMsg.trim().toUpperCase();
                
                if (userResponse === 'YES' || userResponse === 'Y') {
                    console.log(`✓ User confirmed YES for multiple cancellations`);
                    
                    let successCount = 0;
                    let totalRefund = 0;
                    let messages = [];
                    
                    for (const bookingId of bookingIds) {
                        const booking = await Booking.findById(bookingId);
                        if (booking) {
                            try {
                                const result = await cancelBooking(booking, "Customer confirmed bulk cancellation via WhatsApp");
                                successCount++;
                                if (result.refunded) {
                                    totalRefund += result.refundAmount;
                                }
                                messages.push(`✅ ${booking.roomName} on ${formatDate(booking.date)}`);
                            } catch (err) {
                                console.error(`❌ Error cancelling booking ${bookingId}:`, err);
                                messages.push(`❌ ${booking.roomName} on ${formatDate(booking.date)} - Failed`);
                            }
                        }
                    }
                    
                    let finalMsg = `Done! I've cancelled ${successCount} booking(s):\n\n`;
                    finalMsg += messages.join('\n');
                    if (totalRefund > 0) {
                        finalMsg += `\n\n💰 Total refund: MYR ${totalRefund.toFixed(2)}`;
                        finalMsg += `\nThe money should be back in your account within 5-10 business days.`;
                    }
                    finalMsg += `\n\nSee you next time! 😊`;
                    
                    twiml.message(finalMsg);
                    
                    // Clear confirmation mode
                    conversations[fromNumber] = conversations[fromNumber].filter(
                        msg => !msg.content?.startsWith('CONFIRM_CANCEL_MULTIPLE:')
                    );
                    
                    return res.type("text/xml").send(twiml.toString());
                    
                } else if (userResponse === 'NO' || userResponse === 'N') {
                    twiml.message("No worries! Your bookings are still active. See you there! 😊");
                    conversations[fromNumber] = conversations[fromNumber].filter(
                        msg => !msg.content?.startsWith('CONFIRM_CANCEL_MULTIPLE:')
                    );
                    return res.type("text/xml").send(twiml.toString());
                } else {
                    twiml.message("Please reply with 'YES' to cancel all or 'NO' to keep them.");
                    return res.type("text/xml").send(twiml.toString());
                }
            }
            
            if (lastMsg.content?.startsWith('CONFIRM_CANCEL:')) {
                const bookingId = lastMsg.content.replace('CONFIRM_CANCEL:', '');
                const userResponse = incomingMsg.trim().toUpperCase();
                
                console.log(`🔍 CONFIRM_CANCEL mode active - User: "${userResponse}", Booking: ${bookingId}`);
                
                if (userResponse === 'YES' || userResponse === 'Y') {
                    console.log(`✓ User confirmed YES`);
                    const booking = await Booking.findById(bookingId);
                    
                    if (booking) {
                        console.log(`✅ Found booking ${booking._id} - Status: ${booking.status}`);
                        
                        try {
                            const result = await cancelBooking(booking, "Customer confirmed cancellation via WhatsApp");
                            
                            console.log(`✅ Cancellation successful - Message: ${result.message.substring(0, 50)}...`);
                            
                            // Send the cancellation message via twiml
                            twiml.message(result.message);
                            
                            console.log(`📤 Added message to twiml`);
                            
                            // Clear confirmation mode
                            conversations[fromNumber] = conversations[fromNumber].filter(
                                msg => !msg.content?.startsWith('CONFIRM_CANCEL:')
                            );
                            
                            console.log(`🧹 Cleared confirmation mode`);
                            console.log(`📤 Sending twiml response...`);
                            
                            return res.type("text/xml").send(twiml.toString());
                        } catch (err) {
                            console.error("❌ Cancellation error:", err);
                            twiml.message("Oops, something went wrong while cancelling. Can you try again or contact support?");
                            conversations[fromNumber] = conversations[fromNumber].filter(
                                msg => !msg.content?.startsWith('CONFIRM_CANCEL:')
                            );
                            return res.type("text/xml").send(twiml.toString());
                        }
                    } else {
                        console.error("❌ Booking not found:", bookingId);
                        twiml.message("Hmm, I couldn't find that booking. It might have already been cancelled.");
                        conversations[fromNumber] = conversations[fromNumber].filter(
                            msg => !msg.content?.startsWith('CONFIRM_CANCEL:')
                        );
                        return res.type("text/xml").send(twiml.toString());
                    }
                } else if (userResponse === 'NO' || userResponse === 'N') {
                    twiml.message("No worries! Your booking is still active. See you there! 😊");
                    // Clear confirmation mode
                    conversations[fromNumber] = conversations[fromNumber].filter(
                        msg => !msg.content?.startsWith('CONFIRM_CANCEL:')
                    );
                    return res.type("text/xml").send(twiml.toString());
                } else {
                    twiml.message("Please reply with 'YES' to cancel or 'NO' to keep your booking.");
                    return res.type("text/xml").send(twiml.toString());
                }
            }
            
            // Check if selecting from multiple bookings
            if (lastMsg.content?.startsWith('SELECT_BOOKING:')) {
                const bookingIds = lastMsg.content.replace('SELECT_BOOKING:', '').split(',');
                const userInput = incomingMsg.trim().toUpperCase();
                
                // Handle ALL/BOTH
                if ((userInput === 'ALL' && bookingIds.length > 2) || 
                    (userInput === 'BOTH' && bookingIds.length === 2) ||
                    userInput === 'ALL' || userInput === 'BOTH') {
                    
                    // Check if they meant something else
                    if (userInput === 'BOTH' && bookingIds.length > 2) {
                        twiml.message(`You have ${bookingIds.length} bookings. Did you mean 'ALL' to cancel all of them? Or reply with specific numbers separated by commas (like '1,2,3').`);
                        return res.type("text/xml").send(twiml.toString());
                    }
                    
                    if (userInput === 'ALL' && bookingIds.length === 2) {
                        // Allow "ALL" for 2 bookings too
                    }
                    
                    // Confirm cancellation of all/both
                    const bookings = await Booking.find({ _id: { $in: bookingIds } });
                    
                    let confirmMsg = `Are you sure you want to cancel ALL ${bookings.length} bookings?\n\n`;
                    let totalRefund = 0;
                    let hasNonRefundable = false;
                    
                    bookings.forEach((booking, index) => {
                        confirmMsg += `${index + 1}. Room ${booking.roomName} - ${formatDate(booking.date)} at ${convertTo12Hour(booking.time)}\n`;
                        
                        if (booking.status === "completed") {
                            const [startTime] = booking.time.split('-');
                            const bookingDateTime = `${booking.date}T${startTime}:00+08:00`;
                            const eligibleForRefund = canCancelWithRefund(bookingDateTime);
                            
                            if (eligibleForRefund) {
                                totalRefund += booking.amountPaid;
                            } else {
                                hasNonRefundable = true;
                            }
                        }
                    });
                    
                    confirmMsg += `\n`;
                    if (totalRefund > 0) {
                        confirmMsg += `💰 Total refund: MYR ${totalRefund.toFixed(2)}\n`;
                    }
                    if (hasNonRefundable) {
                        confirmMsg += `⚠️ Some bookings are non-refundable (less than 24h)\n`;
                    }
                    confirmMsg += `\nReply "YES" to cancel all or "NO" to keep them.`;
                    
                    twiml.message(confirmMsg);
                    
                    // Store context for multiple cancellations
                    conversations[fromNumber] = conversations[fromNumber].filter(
                        msg => !msg.content?.startsWith('SELECT_BOOKING:')
                    );
                    conversations[fromNumber].push({
                        role: "system",
                        content: `CONFIRM_CANCEL_MULTIPLE:${bookingIds.join(',')}`
                    });
                    
                    return res.type("text/xml").send(twiml.toString());
                }
                
                // Handle single number selection
                const choice = parseInt(userInput);

                if (!isNaN(choice) && choice >= 1 && choice <= bookingIds.length) {
                    const bookingId = bookingIds[choice - 1];
                    const booking = await Booking.findById(bookingId);

                    if (booking) {
                        // Now show confirmation for selected booking
                        const [startTime] = booking.time.split('-');
                        const bookingDateTime = `${booking.date}T${startTime}:00+08:00`;
                        const eligibleForRefund = canCancelWithRefund(bookingDateTime);
                        
                        let confirmMsg = `Are you sure you want to cancel this booking?\n\n`;
                        confirmMsg += `📍 Room ${booking.roomName}\n`;
                        confirmMsg += `📅 ${formatDate(booking.date)} at ${convertTo12Hour(booking.time)}\n`;
                        
                        if (booking.status === "completed") {
                            confirmMsg += `💰 Paid: MYR ${booking.amountPaid.toFixed(2)}\n\n`;
                            if (eligibleForRefund) {
                                confirmMsg += `✅ You'll get a FULL REFUND of MYR ${booking.amountPaid.toFixed(2)}\n\n`;
                            } else {
                                confirmMsg += `❌ NO REFUND (less than 24 hours to booking time)\n\n`;
                            }
                        } else {
                            confirmMsg += `⏳ Payment pending - No charges\n\n`;
                        }
                        
                        confirmMsg += `Reply "YES" to confirm cancellation or "NO" to keep your booking.`;
                        
                        twiml.message(confirmMsg);
                        
                        // Replace SELECT_BOOKING with CONFIRM_CANCEL
                        conversations[fromNumber] = conversations[fromNumber].filter(
                            msg => !msg.content?.startsWith('SELECT_BOOKING:')
                        );
                        conversations[fromNumber].push({
                            role: "system",
                            content: `CONFIRM_CANCEL:${booking._id}`
                        });
                        
                        return res.type("text/xml").send(twiml.toString());
                    }
                }

                twiml.message("I didn't catch that. Reply with a number, 'ALL', or 'BOTH' to cancel multiple bookings.");
                return res.type("text/xml").send(twiml.toString());
            }
        }

        // Check for duplicate pending bookings before new booking
        const pendingBookings = await getUserPendingBookings(fromNumber);
        if (pendingBookings.length > 0) {
            const pending = pendingBookings[0];
            const timeLeft = Math.ceil((new Date(pending.expiresAt) - new Date()) / 60000);
            
            twiml.message(`Hey! You still have a pending booking that expires in ${timeLeft} minutes:\n\n📍 Room ${pending.roomName}\n📅 ${formatDate(pending.date)} at ${convertTo12Hour(pending.time)}\n\nPlease complete that payment first, or say "cancel" to cancel it and make a new booking. 😊`);
            return res.type("text/xml").send(twiml.toString());
        }

        if (!conversations[fromNumber]) {
            conversations[fromNumber] = [];
        }

        const rooms = await getRoomsData();
        if (rooms.length === 0) {
            twiml.message("Sorry, no rooms are available at the moment.");
            return res.type("text/xml").send(twiml.toString());
        }

        const roomsInfo = rooms
            .map(r => `Room ${r.name}: Price MYR ${r.price}, Seats ${r.seats}, Projector: ${r.projector ? "Yes" : "No"}`)
            .join("\n");

        const today = getCurrentDateMY();

        const tomorrow = calculateRelativeDate('tomorrow', today);
        const nextMonday = calculateRelativeDate('next monday', today);
        const nextTuesday = calculateRelativeDate('next tuesday', today);
        const nextWednesday = calculateRelativeDate('next wednesday', today);
        const nextThursday = calculateRelativeDate('next thursday', today);
        const nextFriday = calculateRelativeDate('next friday', today);
        const nextSaturday = calculateRelativeDate('next saturday', today);
        const nextSunday = calculateRelativeDate('next sunday', today);

        let processedMsg = incomingMsg;
        const dateReplacements = {
            'next monday': nextMonday,
            'next tuesday': nextTuesday,
            'next wednesday': nextWednesday,
            'next thursday': nextThursday,
            'next friday': nextFriday,
            'next saturday': nextSaturday,
            'next sunday': nextSunday,
            'tomorrow': tomorrow
        };

        for (const [phrase, date] of Object.entries(dateReplacements)) {
            const regex = new RegExp(phrase, 'gi');
            if (regex.test(processedMsg)) {
                processedMsg = processedMsg.replace(regex, `${phrase} (${date})`);
            }
        }

        const systemContentWithRooms = systemPrompt.content
            .replace('CURRENT_DATE_PLACEHOLDER', today)
            + `\n\nAvailable rooms (prices are PER HOUR):\n${roomsInfo}`
            + `\n\nADD-ONS AVAILABLE (prices are PER HOUR):
1. Projector - MYR ${ADDON_PRICES.projector}/hour
2. LCD Screen - MYR ${ADDON_PRICES.lcdScreen}/hour
3. Extra Chairs - MYR ${ADDON_PRICES.chairs} per chair/hour

IMPORTANT: Room prices and add-on prices are calculated based on booking duration.
Example: 2-hour booking with 1 projector = (Room price × 2) + (50 × 2)

After confirming booking details, ALWAYS ask about add-ons.
If user says yes or mentions equipment, ask which ones and how many.
If user says no or none, proceed with booking confirmation.`
            + `\n\nIMPORTANT DATE MAPPINGS (always use these):
Today = ${today}
Tomorrow = ${tomorrow}
Next Monday = ${nextMonday}
Next Tuesday = ${nextTuesday}
Next Wednesday = ${nextWednesday}
Next Thursday = ${nextThursday}
Next Friday = ${nextFriday}
Next Saturday = ${nextSaturday}
Next Sunday = ${nextSunday}

When user mentions "next Friday", you MUST respond with ${nextFriday}.
When user mentions "next Monday", you MUST respond with ${nextMonday}.

CRITICAL FORMAT RULES:
- When mentioning dates to users, ALWAYS use DD/MM/YYYY format (like "10/12/2025", never "2025-12-10")
- When mentioning times to users, ALWAYS use 12-hour format with AM/PM (like "2:00 PM - 5:00 PM", never "14:00-17:00")
- Be casual and friendly in your responses, not robotic
- Use emojis naturally 😊

BOOKING CONFIRMATION FORMAT:
When you have all required info (room, date, time) and user confirms, respond with ONLY:
CONFIRM_BOOKING
{"roomName": "X", "date": "YYYY-MM-DD", "time": "HH:MM-HH:MM"}

Do NOT add any other text before or after CONFIRM_BOOKING. No explanations, no confirmations, just the command and JSON.
NOTE: The JSON format above is for the system only. When talking to users, use friendly formats.

CANCELLATION POLICY:
- Cancellation must be made at least 24 hours before booking time for full refund
- No refund for cancellations less than 24 hours before booking
- Unpaid bookings can be cancelled anytime without penalty
If user asks about cancellation, explain this policy clearly in a friendly, conversational way.`;

        conversations[fromNumber].push(defaultUserPrompt(processedMsg));

        const messages = [
            { role: "system", content: systemContentWithRooms },
            ...conversations[fromNumber]
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            max_tokens: 350,
            temperature: 0.7,
        });

        const aiResponse = completion.choices[0].message.content.trim();
        conversations[fromNumber].push({ role: "assistant", content: aiResponse });

        console.log(`🤖 AI Response: ${aiResponse.substring(0, 100)}...`);

        // Check if response contains CONFIRM_BOOKING (might have text before it)
        if (aiResponse.includes("CONFIRM_BOOKING")) {
            console.log(`🎫 CONFIRM_BOOKING detected - processing booking...`);
            
            // Extract the part after CONFIRM_BOOKING
            const confirmIndex = aiResponse.indexOf("CONFIRM_BOOKING");
            const jsonStr = aiResponse.substring(confirmIndex + "CONFIRM_BOOKING".length).trim();

            let bookingDetails;
            try {
                bookingDetails = JSON.parse(jsonStr);
                console.log(`✅ Parsed booking details:`, bookingDetails);
            } catch (parseErr) {
                console.error(`❌ Failed to parse booking JSON:`, parseErr);
                twiml.message("Hmm, I couldn't understand the booking details. Could you please rephrase?");
                return res.type("text/xml").send(twiml.toString());
            }

            const { roomName, date, time } = bookingDetails;

            if (!roomName || !date || !time) {
                twiml.message("Looks like some booking info is missing. Can you please confirm the room, date, and time?");
                return res.type("text/xml").send(twiml.toString());
            }

            const dateValidation = validateDate(date);
            if (!dateValidation.valid) {
                twiml.message(`Sorry, ${dateValidation.error}. Please choose a valid future date.`);
                return res.type("text/xml").send(twiml.toString());
            }

            const timeValidation = validateTime(time, date);
            if (!timeValidation.valid) {
                twiml.message(`Sorry, ${timeValidation.error}. Please choose a valid future time slot.`);
                return res.type("text/xml").send(twiml.toString());
            }

            const room = rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());

            if (!room) {
                twiml.message(`Sorry, I couldn't find room "${roomName}". Please choose from: ${rooms.map(r => r.name).join(", ")}.`);
                return res.type("text/xml").send(twiml.toString());
            }

            const conflict = await checkBookingConflict(room.name, date, time);

            if (conflict) {
                const timeLeft = Math.ceil((new Date(conflict.expiresAt) - new Date()) / 1000);
                const timeDisplay = timeLeft < 60 ? `${timeLeft} seconds` : `${Math.ceil(timeLeft / 60)} minutes`;

                const conflictMsg = conflict.status === "completed"
                    ? `Sorry! Room ${room.name} on ${date} is already booked during ${conflict.time}. Your requested time ${time} overlaps. Please choose a different time or room.`
                    : `Oops! Room ${room.name} on ${date} during ${conflict.time} is being booked by someone else (expires in ${timeDisplay}). Your requested time ${time} overlaps. Please wait or choose a different time/room.`;

                twiml.message(conflictMsg);
                return res.type("text/xml").send(twiml.toString());
            }

            // Ask about add-ons before creating booking
            const duration = calculateDuration(time);
            const addonsMsg = `Perfect! Room ${room.name} is available ${formatDate(date)} at ${convertTo12Hour(time)} (${duration} hour${duration !== 1 ? 's' : ''}) 👍\n\nWant to add anything? We have:\n• Projector (MYR ${ADDON_PRICES.projector}/hr)\n• LCD Screen (MYR ${ADDON_PRICES.lcdScreen}/hr)\n• Extra Chairs (MYR ${ADDON_PRICES.chairs}/chair/hr)\n\nJust let me know what you need, or say "no" if you're good!`;
            
            twiml.message(addonsMsg);
            
            // Store booking details in conversation context
            conversations[fromNumber] = conversations[fromNumber] || [];
            conversations[fromNumber].push({
                role: "system",
                content: `AWAITING_ADDONS:${JSON.stringify({roomName: room.name, date, time, roomPrice: room.price, duration})}`
            });
            
            return res.type("text/xml").send(twiml.toString());
        }

        // Don't send CONFIRM_BOOKING text to users
        if (!aiResponse.includes("CONFIRM_BOOKING")) {
            console.log(`💬 Sending AI response to user`);
            twiml.message(aiResponse);
        } else {
            console.log(`⚠️ CONFIRM_BOOKING was in response but not processed - shouldn't reach here`);
            twiml.message("Let me help you with that booking!");
        }
        
        return res.type("text/xml").send(twiml.toString());

    } catch (err) {
        console.error("❌ Error handling /whatsapp:", err);
        twiml.message("Sorry boss, something went wrong 😭 Try again?");
        return res.type("text/xml").send(twiml.toString());
    }
});

// Stripe Webhook
app.post("/stripe-webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("❌ Webhook signature failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const whatsappNumber = session.metadata.whatsappNumber;
        const bookingId = session.metadata.bookingId;
        const amountPaid = (session.amount_total / 100).toFixed(2);

        console.log(`💳 Checkout completed - Booking: ${bookingId}`);

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            console.error("❌ Booking not found:", bookingId);
            return res.json({ received: true });
        }

        if (booking.status === "cancelled") {
            console.log(`⚠️ Booking ${bookingId} was cancelled - ignoring payment`);
            return res.json({ received: true });
        }

        if (booking && booking.status === "pending") {
            booking.status = "completed";
            booking.amountPaid = parseFloat(amountPaid);

            try {
                // Retrieve payment intent to get card details and store payment intent ID
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
                booking.paymentIntentId = paymentIntent.id;
                
                const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
                
                // Get card details
                const paymentInfo = {
                    cardBrand: paymentMethod.card.brand.charAt(0).toUpperCase() + paymentMethod.card.brand.slice(1),
                    last4: paymentMethod.card.last4
                };

                console.log('💳 Payment card info:', paymentInfo);

                const invoiceData = await generateInvoicePDF(booking, amountPaid, paymentInfo);
                booking.invoiceNumber = invoiceData.invoiceNumber;
                await booking.save();

                console.log(`📄 Invoice generated: ${invoiceData.fileName}`);

                const invoiceUrl = `${process.env.BASE_URL}/invoices/${invoiceData.fileName}`;

                const confirmationMsg = `🎉 Awesome! Your payment went through and your booking is confirmed!\n\n📍 Room ${booking.roomName}\n📅 ${formatDate(booking.date)}\n⏰ ${convertTo12Hour(booking.time)}\n💰 Paid: MYR ${amountPaid}\n\n📋 Need to cancel? Just let me know at least 24 hours before and you'll get a full refund.\n\nSee you there! 😊`;

                await client.messages
                    .create({
                        from: "whatsapp:+14155238886",
                        to: "whatsapp:" + whatsappNumber,
                        body: confirmationMsg,
                        mediaUrl: [invoiceUrl]
                    })
                    .then(msg => console.log("✅ Confirmation sent with PDF invoice:", msg.sid))
                    .catch(err => console.error("❌ Failed to send confirmation:", err));

            } catch (pdfErr) {
                console.error("❌ Error generating PDF:", pdfErr);

                const confirmationMsg = `🎉 Awesome! Your payment went through and your booking is confirmed!\n\n📍 Room ${booking.roomName}\n📅 ${formatDate(booking.date)}\n⏰ ${convertTo12Hour(booking.time)}\n💰 Paid: MYR ${amountPaid}\n\n📋 Need to cancel? Just let me know at least 24 hours before and you'll get a full refund.\n\nSee you there! 😊`;

                await client.messages
                    .create({
                        from: "whatsapp:+14155238886",
                        to: "whatsapp:" + whatsappNumber,
                        body: confirmationMsg,
                    })
                    .then(msg => console.log("✅ Confirmation sent:", msg.sid))
                    .catch(err => console.error("❌ Failed to send confirmation:", err));
            }
        }
    } else if (event.type === "checkout.session.expired") {
        const session = event.data.object;
        const whatsappNumber = session.metadata.whatsappNumber;
        const bookingId = session.metadata.bookingId;

        const booking = await Booking.findById(bookingId);
        if (booking && booking.status === "pending") {
            booking.status = "cancelled";
            await booking.save();

            const cancelMsg = `Hey! Your booking timed out because the payment wasn't completed. No worries though!\n\n📍 Room ${booking.roomName}\n📅 ${formatDate(booking.date)}\n⏰ ${convertTo12Hour(booking.time)}\n\nFeel free to book again whenever you're ready! 😊`;

            client.messages
                .create({
                    from: "whatsapp:+14155238886",
                    to: "whatsapp:" + whatsappNumber,
                    body: cancelMsg,
                })
                .then(msg => console.log("✅ Cancellation notice sent:", msg.sid))
                .catch(err => console.error("❌ Failed to send cancellation notice:", err));
        }
    }

    res.json({ received: true });
});

// Payment pages routes
app.use('/', paymentRoutes);

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
        uptime: process.uptime(),
    });
});

// Admin - view bookings
app.get("/bookings", async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 }).limit(50);
        res.json({ total: bookings.length, bookings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(3000, () => {
    console.log("🚀 WhatsApp Bot Server running on port 3000");
    console.log("⏰ Booking timeout: 30 minutes");
    console.log("📄 Invoices directory:", invoicesDir);
    console.log("🌐 Base URL:", process.env.BASE_URL);
    console.log("📋 Cancellation policy: 24 hours for full refund");
    console.log("🤖 WhatsApp cancellation: Fully automated");
});