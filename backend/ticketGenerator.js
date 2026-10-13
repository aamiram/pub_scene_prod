const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

/**
 * Generates a high-resolution, mobile-friendly PDF Ticket
 * @param {Object} data Booking and event data
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generateTicketPdf(data) {
  const {
    passCode = "PUB-000000",
    eventTitle = "PUB SCENE EXCLUSIVE EVENT",
    eventVenue = "Venue TBA, Nagpur",
    eventDate = "Tonight • 8:00 PM Onwards",
    guestName = "Guest",
    guestPhone = "N/A",
    guestAge = "21+",
    guestEmail = "",
    passesSummary = "1 Entry Pass",
    totalAmount = 0
  } = data;

  const qrData = `PUBSCENE:${passCode}`;
  const qrBuffer = await QRCode.toBuffer(qrData, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 220,
    color: { dark: "#000000", light: "#ffffff" }
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [420, 780],
      margins: { top: 20, bottom: 20, left: 24, right: 24 }
    });

    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    // Dark sleek cyberpunk background
    doc.rect(0, 0, 420, 780).fill("#0c091a");

    // Header Glow Banner
    doc.rect(0, 0, 420, 75).fill("#171338");
    doc.rect(0, 72, 420, 3).fill("#bd00ff");

    // Brand Name
    doc.fillColor("#00f0ff").fontSize(22).font("Helvetica-Bold").text("PUB SCENE", 24, 20, { characterSpacing: 2 });
    doc.fillColor("#bd00ff").fontSize(9).font("Helvetica-Bold").text("OFFICIAL DIGITAL ENTRY PASS", 24, 46, { characterSpacing: 1.5 });

    // Official Pass Badge
    doc.roundedRect(280, 22, 116, 28, 6).fill("#231c4f");
    doc.fillColor("#00f0ff").fontSize(9).font("Helvetica-Bold").text("CONFIRMED PASS", 280, 31, { width: 116, align: "center" });

    // Event Info Card
    doc.roundedRect(24, 90, 372, 95, 10).fill("#151133");
    doc.lineWidth(1).strokeColor("#352c6e").roundedRect(24, 90, 372, 95, 10).stroke();

    doc.fillColor("#ff007f").fontSize(9).font("Helvetica-Bold").text("EVENT ADMISSION", 36, 102);
    doc.fillColor("#ffffff").fontSize(14).font("Helvetica-Bold").text(eventTitle.toUpperCase(), 36, 116, { width: 348, ellipsis: true });
    
    doc.fillColor("#a59bc8").fontSize(10).font("Helvetica").text(`Venue: ${eventVenue}`, 36, 138, { width: 348, ellipsis: true });
    doc.fillColor("#00f0ff").fontSize(10).font("Helvetica-Bold").text(`Date:  ${eventDate}`, 36, 156);

    // Guest Details Section
    doc.roundedRect(24, 196, 372, 115, 10).fill("#120e2b");
    doc.lineWidth(1).strokeColor("#2f275e").roundedRect(24, 196, 372, 115, 10).stroke();

    // Guest Left Column
    doc.fillColor("#8e82b7").fontSize(8).font("Helvetica-Bold").text("GUEST NAME", 36, 208);
    doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold").text(guestName.toUpperCase(), 36, 220, { width: 180, ellipsis: true });

    doc.fillColor("#8e82b7").fontSize(8).font("Helvetica-Bold").text("PHONE / AGE", 36, 246);
    doc.fillColor("#ffffff").fontSize(10).font("Helvetica").text(`${guestPhone}  •  ${guestAge} yrs`, 36, 258);

    doc.fillColor("#8e82b7").fontSize(8).font("Helvetica-Bold").text("PASSES RESERVED", 36, 278);
    doc.fillColor("#00f0ff").fontSize(11).font("Helvetica-Bold").text(passesSummary, 36, 290, { width: 180, ellipsis: true });

    // Right Column (Pass Code & Billing)
    doc.fillColor("#8e82b7").fontSize(8).font("Helvetica-Bold").text("PASS CODE", 230, 208);
    doc.fillColor("#00f0ff").fontSize(14).font("Helvetica-Bold").text(`#${passCode}`, 230, 220);

    doc.fillColor("#8e82b7").fontSize(8).font("Helvetica-Bold").text("AMOUNT PAID", 230, 246);
    doc.fillColor("#25D366").fontSize(13).font("Helvetica-Bold").text(`Rs. ${Number(totalAmount).toLocaleString("en-IN")}`, 230, 258);

    doc.fillColor("#8e82b7").fontSize(8).font("Helvetica-Bold").text("STATUS", 230, 278);
    doc.fillColor("#bd00ff").fontSize(10).font("Helvetica-Bold").text("VERIFIED & ACTIVE", 230, 290);

    // Perforated Tear Line
    doc.lineWidth(1).dash(4, { space: 4 }).strokeColor("#4a3e87").moveTo(24, 324).lineTo(396, 324).stroke();
    doc.undash();

    // Central High-Resolution QR Code Card
    doc.roundedRect(105, 336, 210, 225, 12).fill("#ffffff");
    doc.image(qrBuffer, 120, 346, { width: 180, height: 180 });
    doc.fillColor("#110f22").fontSize(8).font("Helvetica-Bold").text("SECURITY SCAN AT GATE", 105, 532, { width: 210, align: "center" });
    doc.fillColor("#5f259f").fontSize(10).font("Helvetica-Bold").text(`#${passCode}`, 105, 544, { width: 210, align: "center" });

    // Anti-Fraud Warning Box (Explicit Requirement)
    doc.roundedRect(24, 574, 372, 138, 8).fill("#1c1020");
    doc.lineWidth(1.5).strokeColor("#ff0055").roundedRect(24, 574, 372, 138, 8).stroke();

    doc.fillColor("#ff0055").fontSize(10).font("Helvetica-Bold").text("WARNING: STRICT ONE-TIME SCAN ONLY", 36, 584);

    doc.fillColor("#f5d0d8").fontSize(8.5).font("Helvetica").text(
      "• SINGLE USE ONLY: This unique QR code becomes PERMANENTLY INVALID immediately upon being scanned at the venue entrance.\n" +
      "• NO DUPLICATE ADMISSION: If this ticket screenshot is shared or forwarded, ONLY THE FIRST PERSON SCANNED will be admitted. Any duplicate scan triggers an immediate 'ALREADY SCANNED' error and entry will be denied.\n" +
      "• Mandatory physical or DigiLocker Government Photo ID required (Age 21+).\n" +
      "• Club dress code and right of admission strictly reserved by venue management.",
      36,
      602,
      { width: 348, lineGap: 3.5 }
    );

    // Footer
    doc.fillColor("#6f6396").fontSize(8).font("Helvetica").text(
      "PUB SCENE Pass Verification System  •  Guest Support: +91 8855882926  •  https://pubscene.in",
      24,
      730,
      { width: 372, align: "center" }
    );

    doc.end();
  });
}

module.exports = { generateTicketPdf };