import fs from 'fs/promises';
import visionClient from '../config/visionClient'; // Assuming this is correctly configured

export interface ParsedItem {
    itemName: string;
    quantity: number;
    unitPrice: number; // Renamed from 'price' for clarity (N/Rate)
    totalPrice: number; // Added for the 'Value' column
    hsnCode: string | null; // Added for HSN
    category: string | null;
}

export interface ParsedReceipt {
    items: ParsedItem[];
    total: number | null;
    subtotal: number | null;
    tax: number | null;
    rawText: string;
    billNo: string | null;
    billDate: string | null;
    cashier: string | null;
    storeName: string | null;
    address: string | null;
    phone: string | null;
}

export async function extractReceiptDataFromBuffer(buffer: Buffer): Promise<ParsedReceipt> {
    const [result] = await visionClient.textDetection({ image: { content: buffer } });
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
        throw new Error('No text found in image.');
    }

    const fullText = detections[0].description || '';
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

    const items: ParsedItem[] = [];
    let total: number | null = null;
    let subtotal: number | null = null;
    let tax: number | null = null;
    let billNo: string | null = null;
    let billDate: string | null = null;
    let cashier: string | null = null;
    let storeName: string | null = null;
    let address: string | null = null;
    let phone: string | null = null;

    // --- General Information Extraction ---
    const billNoRegex = /(Bill No|Invoice No|Receipt No)\s*[:\s]*([a-zA-Z0-9-]+)/i;
    const billDateRegex = /(Bill Dt|Date|Dt)\s*[:\s]*(\d{2}[-/.]\d{2}[-/.]\d{2,4}(?:\s*\(?\s*\d{1,2}:\d{2}(?:[AP]M)?\s*\)?)?)/i;
    const cashierRegex = /(Cashier|CASHIER|CSC)\s*[:\s]*([a-zA-Z0-9\/]+)/i;
    const phoneRegex = /(Phone|Ph)\s*[:\s]*(\d{10,13})/i;

    const storeNameCandidates = ["DMART", "AVENUE SUPERMARTS LTD"];
    let foundStoreName = false;
    let potentialAddressLines: string[] = [];
    let processingAddress = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Extracting Bill No, Bill Date, Cashier, Phone
        if (!billNo) {
            const match = line.match(billNoRegex);
            if (match) billNo = match[2].trim();
        }
        if (!billDate) {
            const match = line.match(billDateRegex);
            if (match) {
                billDate = match[2].replace(/\s*\(?\s*\d{1,2}:\d{2}(?:[AP]M)?\s*\)?/, '').trim();
                const parts = billDate.split(/[-./]/);
                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    const fullYear = year.length === 2 ? `20${year}` : year;
                    billDate = `${fullYear}-${month}-${day}`;
                }
            }
        }
        if (!cashier) {
            const match = line.match(cashierRegex);
            if (match) cashier = match[2].trim();
        }
        if (!phone) {
            const match = line.match(phoneRegex);
            if (match) phone = match[2].trim();
        }

        // Attempt to find store name and address near the top
        if (!storeName && !foundStoreName) {
            for (const nameCand of storeNameCandidates) {
                if (line.toUpperCase().includes(nameCand)) {
                    storeName = nameCand;
                    foundStoreName = true;
                    // Start collecting potential address lines from the next line
                    processingAddress = true;
                    continue; // Move to the next line to start collecting address
                }
            }
        }

        if (processingAddress) {
            // Stop collecting address lines if we hit a known section header or an item header
            if (line.match(/^(TAX INVOICE|HSN Particulars|Bill No|Phone)/i) || (line.includes("HSN") && line.includes("Particulars"))) {
                processingAddress = false;
            } else {
                potentialAddressLines.push(line);
            }
        }
    }
    address = potentialAddressLines.join(', ').trim();


    // --- Item Parsing Logic ---
    // Find the start of the item list, typically after "HSN Particulars Qty/Kg N/Rate Value"
    let itemSectionStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        // Look for the "HSN Particulars" line which seems to be consistent
        if (lines[i].includes("HSN") && lines[i].includes("Particulars")) {
            itemSectionStartIndex = i + 1; // Items start after this line
            // We also need to skip the next two lines that often contain Qty/Kg, N/Rate, Value headers
            // based on the provided rawText.
            // This is a heuristic based on the specific receipt format.
            if (itemSectionStartIndex + 2 < lines.length &&
                lines[itemSectionStartIndex].includes("Qty/Kg") &&
                lines[itemSectionStartIndex + 1].includes("N/Rate") &&
                lines[itemSectionStartIndex + 2].includes("Value")) {
                itemSectionStartIndex += 3;
            } else if (itemSectionStartIndex + 1 < lines.length &&
                lines[itemSectionStartIndex].includes("Qty/Kg") &&
                lines[itemSectionStartIndex + 1].includes("N/Rate")) { // Another common pattern
                 itemSectionStartIndex += 2;
            } else if (itemSectionStartIndex < lines.length && lines[itemSectionStartIndex].includes("Qty/Kg")) {
                itemSectionStartIndex += 1;
            }
            break;
        }
    }

    // Regex to identify potential numerical values (quantity, price)
    const numberRegex = /^\d+(\.\d+)?$/;

    if (itemSectionStartIndex !== -1) {
        for (let i = itemSectionStartIndex; i < lines.length; i++) {
            const line = lines[i];

            // Skip lines that are clearly not item entries (e.g., tax lines, headers)
            if (line.includes("CGST") || line.includes("SGST") || line.includes("total") || line.includes("subtotal") || line.includes("tax") ||
                line.includes("Vou. No") || line.includes("Bill Dt") || line.includes("Cashier") || line.includes("Phone") ||
                line.includes("D Mart") || line.includes("AVENUE SUPERMARTS")) {
                continue;
            }

            // Attempt to parse an item which spans across 3-4 lines based on the provided rawText structure
            // HSN (optional) Item Name (line i)
            // Quantity (line i+1)
            // Unit Price (line i+2)
            // Total Price (line i+3)

            // Let's look for a pattern:
            // Line i: Potential HSN + Item Name
            // Line i+1: Potential Quantity (number)
            // Line i+2: Potential Unit Price (number)
            // Line i+3: Potential Total Price (number)

            if (i + 3 < lines.length) { // Ensure there are enough lines ahead
                const hsnItemLine = lines[i];
                const quantityLine = lines[i + 1];
                const unitPriceLine = lines[i + 2];
                const totalPriceLine = lines[i + 3];

                // Regex for HSN + Item Name, ensuring HSN is optional at the start
                const hsnItemNameRegex = /^(\d{3,4})?\s*([a-zA-Z\s0-9.,\-'\/@]+)/;
                const hsnItemMatch = hsnItemLine.match(hsnItemNameRegex);

                if (hsnItemMatch) {
                    const hsnCode = hsnItemMatch[1] || null;
                    const itemNameCandidate = hsnItemMatch[2].trim();

                    const quantity = parseFloat(quantityLine);
                    const unitPrice = parseFloat(unitPriceLine);
                    const totalPrice = parseFloat(totalPriceLine);

                    // Validate that the next three lines are indeed numbers
                    const isQuantityValid = !isNaN(quantity) && numberRegex.test(quantityLine);
                    const isUnitPriceValid = !isNaN(unitPrice) && numberRegex.test(unitPriceLine);
                    const isTotalPriceValid = !isNaN(totalPrice) && numberRegex.test(totalPriceLine);

                    if (isQuantityValid && isUnitPriceValid && isTotalPriceValid) {
                        // Perform consistency check
                        const calculatedTotalPrice = parseFloat((quantity * unitPrice).toFixed(2));
                        const isPriceConsistent = Math.abs(calculatedTotalPrice - totalPrice) < 0.05; // 5 paise tolerance

                        // Add the item if valid and consistent, or if it's a special case like 0% tax lines which might not have all numbers
                        // The receipt has "1) CGST @ 0.00%, SGST @ 0.00%" which is not an item.
                        // We need to be careful not to parse that. It's skipped by the initial `continue` check.
                        if (isPriceConsistent || (quantity === 1 && Math.abs(unitPrice - totalPrice) < 0.01)) {
                            items.push({
                                hsnCode: hsnCode,
                                itemName: itemNameCandidate,
                                quantity,
                                unitPrice,
                                totalPrice,
                                category: null,
                            });
                            i += 3; // Skip the next 3 lines as they've been processed
                            continue; // Move to the next potential item
                        }
                    }
                }
            }
             // Handle the lines where ItemName and Qty/Rate/Value are on the same line,
             // like "1905 SARAVANA'S PALAK-100g 2"
             // This needs to be a separate check or a more complex regex.
             // Given the current rawText, it looks like most items split like this:
             // 1905 SARAVANA'S PALAK-100g 2
             // 10.00
             // 20.00
             // This means HSN + ItemName + Qty on line i, then Unit Price on i+1, Total Price on i+2
            if (i + 2 < lines.length) {
                const itemQtyLine = lines[i]; // E.g., "1905 SARAVANA'S PALAK-100g 2"
                const unitPriceLine = lines[i + 1]; // E.g., "10.00"
                const totalPriceLine = lines[i + 2]; // E.g., "20.00"

                // Regex: (HSN optional) Item Name (greedy) Quantity
                const combinedItemQtyRegex = /^(\d{3,4})?\s*([a-zA-Z\s0-9.,\-'\/@]+?)\s+(\d+\.?\d*)$/;
                const combinedMatch = itemQtyLine.match(combinedItemQtyRegex);

                if (combinedMatch) {
                    const hsnCode = combinedMatch[1] || null;
                    const itemNameCandidate = combinedMatch[2].trim();
                    const quantity = parseFloat(combinedMatch[3]);
                    const unitPrice = parseFloat(unitPriceLine);
                    const totalPrice = parseFloat(totalPriceLine);

                    const isUnitPriceValid = !isNaN(unitPrice) && numberRegex.test(unitPriceLine);
                    const isTotalPriceValid = !isNaN(totalPrice) && numberRegex.test(totalPriceLine);

                    if (isUnitPriceValid && isTotalPriceValid) {
                        const calculatedTotalPrice = parseFloat((quantity * unitPrice).toFixed(2));
                        const isPriceConsistent = Math.abs(calculatedTotalPrice - totalPrice) < 0.05;

                        if (isPriceConsistent || (quantity === 1 && Math.abs(unitPrice - totalPrice) < 0.01)) {
                            items.push({
                                hsnCode: hsnCode,
                                itemName: itemNameCandidate,
                                quantity,
                                unitPrice,
                                totalPrice,
                                category: null,
                            });
                            i += 2; // Skip the next 2 lines
                            continue;
                        }
                    }
                }
            }
        }
    }


    // --- Total / Subtotal / Tax Extraction (from reversed lines for robustness) ---
    const totalRegex = /(total|net amount|grand total|amount due|bill amount)\s*[:\s]*(\d[\d.,]+)/i;
    const subtotalRegex = /(subtotal|total before tax)\s*[:\s]*(\d[\d.,]+)/i;
    const taxRegex = /(tax|gst|cgst|sgst|vat)\s*[:\s]*(\d[\d.,]+)/i; // Broader tax capture

    // Iterate from the bottom up to catch totals reliably
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!total && totalRegex.test(line)) {
            const match = line.match(totalRegex);
            if (match) total = parseFloat(match[2].replace(/,/g, ''));
        }
        if (!subtotal && subtotalRegex.test(line)) {
            const match = line.match(subtotalRegex);
            if (match) subtotal = parseFloat(match[1].replace(/,/g, ''));
        }
        if (!tax && taxRegex.test(line)) {
            const match = line.match(taxRegex);
            if (match) tax = parseFloat(match[2].replace(/,/g, ''));
        }
        // Break early if all main financial figures are found
        if (total && subtotal && tax) break;
    }


    return {
        items,
        total,
        subtotal,
        tax,
        rawText: fullText,
        billNo,
        billDate,
        cashier,
        storeName,
        address,
        phone,
    };
}

export async function extractReceiptData(imagePath: string): Promise<ParsedReceipt> {
    const imageBuffer = await fs.readFile(imagePath);
    return await extractReceiptDataFromBuffer(imageBuffer);
}