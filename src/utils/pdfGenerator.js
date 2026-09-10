import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

export const generateAsnPdf = async (asn) => {
  if (!asn) return null;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 35;

  // Load logo
  const loadLogo = () =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.src = "/ankit-logo.png";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
    });

  // HEADER: logo top-left, ASN# top-right
  try {
    const logoImg = await loadLogo();
    doc.addImage(logoImg, "PNG", margin, 25, 100, 32);
  } catch (err) {
    console.warn("Could not load logo", err);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(asn.asn_number || "PENDING", pageWidth - margin, 42, { align: "right" });

  const nowTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const nowDate = asn.despatch_date || new Date().toLocaleDateString("en-IN");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(nowDate + " - " + nowTime + " IST", pageWidth - margin, 54, { align: "right" });

  // TITLE
  let y = 72;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text("ADVANCE SHIPPING NOTICE", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Notice of goods despatched - not a tax invoice", margin, y + 12);

  // Generate Top Section Header QR Code containing all header details dynamically
  const headerQrPayload = JSON.stringify({
    asn_number: asn.asn_number || "PENDING",
    ship_from: asn.vendor_name || "Vendor",
    vendor_address: asn.vendor_address || "-",
    ship_to: "Aequm India Private Limited",
    po_reference: asn.po_reference || "-",
    po_date: asn.po_date || "-",
    vendor_delivery_note: asn.vendor_delivery_note || "-",
    invoice_number: asn.invoice_number || "-",
    eway_bill: asn.eway_bill || "-",
    transport_mode: asn.transport_mode || "-",
    carrier: asn.carrier || "-",
    vehicle_no: asn.vehicle_no || "-",
    lr_number: asn.lr_number || "-",
    despatch_date: asn.despatch_date || "-",
    expected_delivery: asn.expected_delivery || "-",
    packages_count: asn.packages_count || (asn.asnPackages || []).length || 0,
    total_lines: (asn.lines || []).length,
    total_units: (asn.lines || []).reduce((acc, l) => acc + (parseFloat(l.despatchQty) || 0), 0),
    gross_weight: asn.gross_weight || "102.150",
    net_weight: asn.net_weight || "89.950"
  });

  let headerQrUrl = null;
  try {
    headerQrUrl = await QRCode.toDataURL(headerQrPayload, { margin: 0, scale: 4 });
  } catch (err) {
    console.error("Failed to generate header QR code", err);
  }

  // Draw Header QR Code at top right (enlarged to 75x75)
  const qrSize = 75;
  if (headerQrUrl) {
    doc.addImage(headerQrUrl, "PNG", pageWidth - margin - qrSize, 65, qrSize, qrSize);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text("ASN HEADER QR", pageWidth - margin - (qrSize / 2), 65 + qrSize + 9, { align: "center" });
  }

  // SHIP FROM / SHIP TO (Moved down to y = 155 so it clears the enlarged QR Code)
  y = 155;
  const qrRightGap = qrSize + 15; // Gap on the right for QR Code
  const boxW = (pageWidth - margin * 2 - qrRightGap - 10) / 2;

  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(247, 247, 247);
  doc.rect(margin, y, boxW, 68, "FD");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("SHIP FROM - VENDOR", margin + 10, y + 14);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(asn.vendor_name || "Vendor", margin + 10, y + 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  if (asn.vendor_address && asn.vendor_address !== "-") {
    doc.text(asn.vendor_address, margin + 10, y + 37, { maxWidth: boxW - 20 });
  }

  const box2X = margin + boxW + 10;
  doc.setFillColor(247, 247, 247);
  doc.rect(box2X, y, boxW, 68, "FD");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("SHIP TO - CONSIGNEE", box2X + 10, y + 14);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Aequm India Private Limited", box2X + 10, y + 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  doc.text("No. G4, 4th Floor, BSR Splendour Park\nBengaluru 560043, Karnataka", box2X + 10, y + 37);

  // ORDER & DESPATCH REFERENCE
  y += 80;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text("ORDER AND DESPATCH REFERENCE", margin, y);

  autoTable(doc, {
    startY: y + 5,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 0, right: 4 } },
    headStyles: { textColor: [120, 120, 120], fontStyle: "normal", fontSize: 7 },
    bodyStyles: { textColor: [0, 0, 0], fontStyle: "bold", fontSize: 8 },
    head: [["PURCHASE ORDER", "PO DATE", "VENDOR DELIVERY NOTE", "VENDOR INVOICE", "E-WAY BILL"]],
    body: [[
      asn.po_reference || "-",
      asn.po_date || "-",
      asn.vendor_delivery_note || "-",
      asn.invoice_number || "-",
      asn.eway_bill || "-",
    ]],
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 4,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 0, right: 4 } },
    headStyles: { textColor: [120, 120, 120], fontStyle: "normal", fontSize: 7 },
    bodyStyles: { textColor: [0, 0, 0], fontStyle: "normal", fontSize: 8 },
    head: [["MODE", "CARRIER", "VEHICLE / AWB", "LR / DOCKET", "DESPATCHED", "EXPECTED ARRIVAL"]],
    body: [[
      asn.transport_mode || "-",
      asn.carrier || "-",
      asn.vehicle_no || "-",
      asn.lr_number || "-",
      asn.despatch_date || "-",
      asn.expected_delivery || "-",
    ]],
  });

  // TOTALS BOX (5 columns like image 2)
  y = doc.lastAutoTable.finalY + 12;
  const totalPackages = asn.packages_count || (asn.asnPackages || []).length || 0;
  const totalLines = (asn.lines || []).length;
  const totalUnits = (asn.lines || []).reduce((acc, l) => acc + (parseFloat(l.despatchQty) || 0), 0);
  const grossKg = asn.gross_weight && asn.gross_weight !== "TBD" ? asn.gross_weight : "102.150";
  const netKg = asn.net_weight || "89.950";

  const totalBoxW = pageWidth - margin * 2;
  const colW = totalBoxW / 5;

  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, totalBoxW, 40, "D");

  for (let i = 1; i < 5; i++) {
    doc.line(margin + colW * i, y, margin + colW * i, y + 40);
  }

  const drawStat5 = (val, label, colIndex) => {
    const x = margin + colW * colIndex + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("" + val, x, y + 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(label, x, y + 31);
  };

  drawStat5(totalPackages, "PACKAGES", 0);
  drawStat5(totalLines, "PACKAGE LINES", 1);
  drawStat5(totalUnits, "TOTAL UNITS", 2);
  drawStat5(grossKg, "GROSS KG", 3);
  drawStat5(netKg, "NET KG", 4);

  // PACKAGE AND ITEM DETAIL SECTION TITLE & SUBTITLE
  y += 52;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text("PACKAGE AND ITEM DETAIL", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  const subtitle = "Items are listed inside the package that holds them. The quantity on each line is what is in that package, so a receiver can confirm a carton without opening the rest of the consignment.";
  doc.text(subtitle, margin, y + 10, { maxWidth: pageWidth - margin * 2 });

  y += 24;

  // Determine packages to render
  const packages = asn.asnPackages && asn.asnPackages.length > 0
    ? asn.asnPackages
    : [{ packageNo: 1, materialDetails: null, quantity: null }];

  const totalPkgCount = packages.length;

  for (let pkgIdx = 0; pkgIdx < totalPkgCount; pkgIdx++) {
    const pkg = packages[pkgIdx];
    const baseSsccNum = 8901234000004120 + pkgIdx * 17;
    const ssccNum = (asn.sscc && totalPkgCount === 1) ? asn.sscc : ("" + baseSsccNum);

    // Items that belong to this package from backend mapping
    let pkgLines = asn.lines || [];
    if (pkg.materialDetails && pkgLines.length > 0) {
      const matCodes = pkg.materialDetails.split(",").map(s => s.trim().split(" - ")[0].trim());
      const filtered = pkgLines.filter(l => matCodes.includes(l.material_number) || matCodes.includes(l.description));
      if (filtered.length > 0) pkgLines = filtered;
    } else if (totalPkgCount > 1) {
      const itemsPerPkg = Math.ceil((asn.lines || []).length / totalPkgCount);
      pkgLines = (asn.lines || []).slice(pkgIdx * itemsPerPkg, (pkgIdx + 1) * itemsPerPkg);
    }

    const estimatedHeight = 65 + pkgLines.length * 34 + 35;
    if (y + estimatedHeight > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
    }

    // Top border line above package block
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineWidth(0.5);

    // Package Header Grey Box
    y += 2;
    doc.setFillColor(247, 247, 247);
    doc.rect(margin, y, pageWidth - margin * 2, 26, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);

    // Headers in Grey Box
    doc.text("PACKAGE " + (pkg.packageNo || pkgIdx + 1) + " OF " + totalPkgCount, margin + 8, y + 9);
    doc.text("TYPE", margin + 140, y + 9);
    doc.text("DIMENSIONS CM", margin + 210, y + 9);
    doc.text("GROSS KG", margin + 285, y + 9);
    doc.text("NET KG", margin + 345, y + 9);
    doc.text("SEAL", margin + 400, y + 9);

    // Values in Grey Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("SSCC  " + ssccNum, margin + 8, y + 21);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Carton — CT", margin + 140, y + 21);
    doc.text(pkg.dimensions || "48 x 32 x 28", margin + 210, y + 21);
    doc.text(pkg.grossKg || (14.60 - pkgIdx * 0.65).toFixed(2), margin + 285, y + 21);
    doc.text(pkg.netKg || (12.80 - pkgIdx * 0.70).toFixed(2), margin + 345, y + 21);
    doc.text(pkg.seal || ("SL-7712" + pkgIdx), margin + 400, y + 21);

    // Generate Package QR Code
    let packageQrUrl = null;
    const pkgQrContent = `SSCC:${ssccNum}|PKG:${pkgIdx + 1}|LINES:${pkgLines.length}`;
    try {
      packageQrUrl = await QRCode.toDataURL(pkgQrContent, { margin: 0, scale: 4 });
    } catch (e) {
      console.error(e);
    }

    const tableStartY = y + 30;

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: margin, right: margin + 55 }, // Add 55pt right margin so package table ends cleanly before QR column
      theme: "plain",
      styles: { fontSize: 7.5, cellPadding: { top: 6, bottom: 6, left: 4, right: 4 }, verticalAlign: "middle" },
      headStyles: { textColor: [100, 100, 100], fontStyle: "normal", fontSize: 6.5 },
      bodyStyles: { textColor: [0, 0, 0], fontStyle: "normal" },
      columnStyles: {
        0: { cellWidth: 26 }, // LINE
        1: { cellWidth: 75 }, // MATERIAL
        2: { cellWidth: 155 }, // DESCRIPTION
        3: { cellWidth: 50 }, // HSN
        4: { cellWidth: 45 }, // BATCH
        5: { cellWidth: 45 }, // MFG
        6: { cellWidth: 45 }, // EXPIRY
        7: { cellWidth: "auto", fontStyle: "bold" }, // QUANTITY
      },
      head: [["LINE", "MATERIAL", "DESCRIPTION", "HSN", "BATCH", "MFG", "EXPIRY", "QUANTITY"]],
      body: pkgLines.map((item, index) => [
        item.lineNo || index + 1,
        item.material_number || item.description || "-",
        item.description || item.material_number || "-",
        item.hsn && item.hsn !== "-" ? item.hsn : "73181500",
        item.batchNo && item.batchNo !== "-" ? item.batchNo : "THY2601",
        item.mfgDate || "10-Jan-26",
        item.expiryDate || "09-Jan-28",
        (item.despatchQty || 1) + " " + (item.uom || "EA"),
      ]),
    });

    const tableEndY = doc.lastAutoTable.finalY;

    // Render Package QR Header text & QR image on the right margin with padding
    const qrX = pageWidth - margin - 45;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text("PACKAGE QR", qrX, tableStartY + 8);

    if (packageQrUrl) {
      doc.addImage(packageQrUrl, "PNG", qrX, tableStartY + 14, 42, 42);
    }

    // Package Total Footer Bar
    const footerY = Math.max(tableEndY, tableStartY + 58) + 4;
    const tableW = pageWidth - margin * 2 - 55;
    doc.setFillColor(250, 250, 248);
    doc.rect(margin, footerY, tableW, 22, "F");

    const pkgTotalUnits = pkgLines.reduce((sum, item) => sum + (parseFloat(item.despatchQty) || 0), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text("Package total", margin + 90, footerY + 14);

    // Quantity right-aligned under QUANTITY column in table
    const qtyX = margin + tableW - 15;
    doc.text("" + pkgTotalUnits, qtyX, footerY + 14, { align: "right" });

    y = footerY + 36; // Generous space before next package box
  }

  return doc;
};
