import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const invoicesDir = path.join(__dirname, "invoices");
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir);

const logoPath = path.join(__dirname, "assets", "logo.png");

const generateInvoiceNumber = () => {
    const d = new Date();
    return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
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

export const generateInvoicePDF = (booking, amountPaid, paymentInfo = {}) => {
    return new Promise((resolve, reject) => {
        try {
            const invoiceNumber = booking.invoiceNumber || generateInvoiceNumber();
            const fileName = `invoice-${invoiceNumber}.pdf`;
            const filePath = path.join(invoicesDir, fileName);

            const doc = new PDFDocument({ margin: 45, size: "A4" });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const gold = "#C9A961";
            const text = "#333333";
            const gray = "#777777";
            const cream = "#F7F2E9";

            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 50, 40, { width: 80 });
            }

            doc.font("Helvetica-Bold").fontSize(34).fillColor(gold).text("INVOICE", 350, 45);

            let y = 135;

            doc.fontSize(12).fillColor(text).font("Helvetica-Bold").text("Infinity8 Coworking Space", 50, y);

            doc.fontSize(10).fillColor(gray).font("Helvetica")
                .text("Level 28, Menara Binjai\n2, Jalan Binjai, Kuala Lumpur\n50450 Malaysia\nhello@infinity8.co | +60 3 2726 3888", 50, y + 18);

            doc.roundedRect(350, y, 200, 90, 6).fillAndStroke(cream, gold);

            doc.fillColor(gray).fontSize(9).font("Helvetica").text("Invoice Number", 365, y + 10);
            doc.fillColor(text).font("Helvetica-Bold").fontSize(12).text(invoiceNumber, 365, y + 25);

            doc.fillColor(gray).fontSize(9).font("Helvetica").text("Invoice Date", 365, y + 50);
            doc.fillColor(text).font("Helvetica-Bold").fontSize(12)
                .text(formatDate(new Date().toISOString().split('T')[0]), 365, y + 65);

            doc.moveTo(50, 250).lineTo(545, 250).lineWidth(2).strokeColor(gold).stroke();

            doc.font("Helvetica-Bold").fontSize(13).fillColor(gold).text("BILL TO", 50, 265);

            doc.font("Helvetica-Bold").fillColor(text).fontSize(12)
                .text(booking.userName || "Valued Customer", 50, 287);

            doc.font("Helvetica").fontSize(10).fillColor(gray)
                .text(`WhatsApp: ${booking.whatsappNumber}`, 50, 303);

            doc.font("Helvetica-Bold").fontSize(13).fillColor(gold).text("BOOKING DATE", 320, 265);

            doc.font("Helvetica").fontSize(11).fillColor(text)
                .text(formatDate(booking.date), 320, 287);

            const tableTop = 330;

            doc.rect(50, tableTop, 495, 30).fill(gold);

            doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff")
                .text("DESCRIPTION", 60, tableTop + 9)
                .text("DATE", 270, tableTop + 9)
                .text("TIME", 360, tableTop + 9)
                .text("AMOUNT", 460, tableTop + 9);

            doc.rect(50, tableTop + 30, 495, 70).strokeColor(gold).lineWidth(1.3).stroke();

            doc.font("Helvetica-Bold").fontSize(12).fillColor(text)
                .text(`Meeting Room ${booking.roomName}`, 60, tableTop + 40);

            // Show add-ons in description if any
            let descY = tableTop + 56;
            if (booking.adds && booking.adds.length > 0) {
                doc.font("Helvetica").fontSize(9).fillColor(gray)
                    .text("Premium coworking space", 60, descY);
                descY += 12;
                booking.adds.forEach(addon => {
                    const [item, qty] = addon.split(' x');
                    let itemName = item === 'projector' ? 'Projector' : 
                                   item === 'lcdScreen' ? 'LCD Screen' : 
                                   item === 'chairs' ? 'Extra Chairs' : item;
                    doc.text(`+ ${itemName} x${qty}`, 60, descY);
                    descY += 12;
                });
            } else {
                doc.font("Helvetica").fontSize(9).fillColor(gray)
                    .text("Premium coworking space\nIncludes WiFi, AC & amenities", 60, descY);
            }

            doc.font("Helvetica").fontSize(11).fillColor(text)
                .text(formatDate(booking.date), 270, tableTop + 50);
            
            // Time on 2 lines: From and Until
            const [startTime, endTime] = booking.time.split('-');
            doc.font("Helvetica").fontSize(9).fillColor(gray)
                .text("From:", 360, tableTop + 45);
            doc.font("Helvetica").fontSize(10).fillColor(text)
                .text(convertTo12Hour(startTime + '-' + startTime).split(' - ')[0], 360, tableTop + 57);
            
            doc.font("Helvetica").fontSize(9).fillColor(gray)
                .text("Until:", 360, tableTop + 72);
            doc.font("Helvetica").fontSize(10).fillColor(text)
                .text(convertTo12Hour(endTime + '-' + endTime).split(' - ')[0], 360, tableTop + 84);

            doc.font("Helvetica-Bold").fontSize(13).fillColor(gold)
                .text(`MYR ${amountPaid}`, 455, tableTop + 50);

            let summaryY = tableTop + 110;

            doc.font("Helvetica").fontSize(11).fillColor(gray)
                .text("Subtotal:", 370, summaryY)
                .fillColor(text).text(`MYR ${amountPaid}`, 460, summaryY);

            doc.fillColor(gray).text("Tax (0%):", 370, summaryY + 18)
                .fillColor(text).text("MYR 0.00", 460, summaryY + 18);

            doc.rect(350, summaryY + 45, 195, 55).fill(gold);

            doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13)
                .text("TOTAL AMOUNT", 360, summaryY + 55);

            doc.fontSize(21)
                .text(`MYR ${amountPaid}`, 360, summaryY + 78, { width: 175, align: "right" });

            const payY = summaryY + 115;

            doc.roundedRect(350, payY, 195, 38, 6)
                .lineWidth(2).fillAndStroke("#ffffff", gold);

            doc.font("Helvetica-Bold").fontSize(12).fillColor(gold)
                .text("PAYMENT RECEIVED", 350, payY + 10, { align: "center", width: 195 });

            // Payment details with card last 4 digits
            const cardBrand = paymentInfo.cardBrand || "Card";
            const last4 = paymentInfo.last4 || "****";
            
            doc.font("Helvetica").fontSize(10).fillColor(gray)
                .text(`Payment Method: ${cardBrand} •••• ${last4}`, 350, payY + 46)
                .text(`Transaction Date: ${formatDate(new Date().toISOString().split('T')[0])}`, 350, payY + 60);

            doc.font("Helvetica-Bold").fontSize(12).fillColor(gold)
                .text("TERMS & CONDITIONS", 50, payY);

            doc.font("Helvetica").fontSize(9).fillColor(gray)
                .text("• Please arrive 10 minutes before your booking time", 50, payY + 18)
                .text("• Cancellations must be made 24 hours in advance", 50, payY + 32)
                .text("• Additional charges apply for overtime usage", 50, payY + 46)
                .text("• This invoice is valid proof of payment", 50, payY + 60);

            doc.moveTo(50, 750).lineTo(545, 750).strokeColor(gold).lineWidth(2).stroke();

            doc.font("Helvetica-Bold").fontSize(12).fillColor(gold)
                .text("Thank you for choosing Infinity8!", 50, 770, { align: "center", width: 495 });

            doc.end();
            stream.on("finish", () => resolve({ fileName, filePath, invoiceNumber }));
            stream.on("error", reject);

        } catch (err) {
            reject(err);
        }
    });
};

export { invoicesDir };