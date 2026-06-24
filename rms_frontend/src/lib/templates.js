const formatMemoRef = (deptCode, date) => {
  const d = date || new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const code = (deptCode || 'CSS').toUpperCase();
  return `CSSG/${code}/MO/${dd}/${mm}/${yyyy}/01`;
};

const formatMemoDate = (date) => {
  const d = date || new Date();
  return `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`;
};

const buildMemoTemplate = ({ deptCode, fromLabel, toLabel, subjectLabel, headName, headTitle, date }) => {
  const ref = formatMemoRef(deptCode, date);
  const memoDate = formatMemoDate(date);
  const toText = toLabel || 'Target Department';
  const fromText = fromLabel || '';
  const subjectText = subjectLabel || '[Enter subject here]';
  const senderName = headName || '';
  const senderTitle = headTitle || '';

  return `
      <div style="font-family: 'Times New Roman', 'Georgia', serif; max-width: 750px; margin: 0 auto; padding: 40px 50px; color: #1a1a1a; background: white; line-height: 1.5; text-align: justify;">

        <!-- CSS Group Logo (centered) immediately followed by the document title — the
             logo image already carries the company name, so no redundant text label below it -->
        <div style="text-align: center;">
          <img src="/logo.svg" style="display: block; margin: 0 auto; width: 64px; height: auto; border-radius: 8px;" />
        </div>

        <div style="text-align: center; margin: 8px 0 22px 0;">
          <h2 style="font-size: 16px; font-weight: 800; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Internal Memo</h2>
        </div>

        <!-- Header Fields Block — plain flex rows, not a <table>, so the editor's table
             extension (and its visual borders, meant for genuine data grids) never touches
             this purely positional letterhead layout -->
        <div style="display: flex; align-items: baseline; margin-bottom: 5px; font-size: 13px;">
          <span style="width: 85px; font-weight: 800; text-transform: uppercase;">Ref:</span>
          <span style="flex: 1; padding-bottom: 2px; border-bottom: 1px solid #999;"><span data-memo-ref>${ref}</span></span>
          <span style="width: 60px;"></span>
          <span style="width: 180px; font-weight: 800; text-align: right; padding-bottom: 2px; border-bottom: 1px solid #999;"><span data-memo-date>${memoDate}</span></span>
        </div>
        <div style="display: flex; align-items: baseline; margin-bottom: 4px; font-size: 13px;">
          <span style="width: 85px; font-weight: 800; text-transform: uppercase;">To:</span>
          <span style="flex: 1; font-weight: 700;"><span data-memo-to>${toText}</span></span>
        </div>
        <div style="display: flex; align-items: baseline; margin-bottom: 4px; font-size: 13px;">
          <span style="width: 85px; font-weight: 800; text-transform: uppercase;">From:</span>
          <span style="flex: 1;"><span data-memo-from>${fromText}</span></span>
        </div>
        <div style="display: flex; align-items: baseline; margin-bottom: 4px; font-size: 13px;">
          <span style="width: 85px; font-weight: 800; text-transform: uppercase;">Subject:</span>
          <span style="flex: 1; font-weight: 800; padding-bottom: 2px; border-bottom: 2px solid #333;"><span data-memo-subject>${subjectText}</span></span>
        </div>

        <hr style="border: none; border-top: 1px solid #333; margin: 8px 0 20px 0;" />

        <!-- Body Content — generic placeholder showing the expected structure: opening
             statement, supporting points, elaboration, and a closing/next-steps line -->
        <div style="font-size: 13px; line-height: 1.7; min-height: 300px; text-align: justify;">
          <p style="text-indent: 40px; margin: 0 0 15px 0; text-align: justify;">[Opening statement — state the purpose of this memo clearly in one or two sentences.]</p>

          <ol style="padding-left: 25px; margin: 0 0 20px 0; text-align: justify;">
            <li style="margin-bottom: 8px;">[First supporting point or item relevant to this memo.]</li>
            <li style="margin-bottom: 8px;">[Second supporting point or item, if applicable.]</li>
          </ol>

          <p style="text-indent: 40px; margin: 0 0 15px 0; text-align: justify;">[Elaborate on the request, decision, or information being communicated. Keep this section concise and easy to follow.]</p>

          <p style="text-indent: 40px; margin: 0 0 15px 0; text-align: justify;">[Closing statement — note any attachments and state the next steps or action required, if any.]</p>
        </div>

        <!-- Sender Signature Block -->
        <div style="margin-top: 50px; font-size: 13px;">
          <p style="font-weight: 800; margin: 0 0 2px 0; font-size: 14px;"><span data-memo-sender-name>${senderName}</span></p>
          <p style="margin: 0; color: #444; font-size: 12px;"><span data-memo-sender-title>${senderTitle}</span></p>
        </div>
      </div>
    `;
};

// Field labels here are deliberately identical to the PDF generator's Requisition Voucher
// header block in serve.js (Reference No: / From: / To: / Title: / Type: / Urgency: / Date:)
// so a document drafted from this template prints exactly the way the user expects.
const buildMaterialRequestTemplate = ({ deptCode, fromLabel, toLabel, headName, headTitle, date }) => {
  const d = date || new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const refValue = `CSSG/${(deptCode || 'CSS').toUpperCase()}/MR/${dd}/${mm}/${yyyy}/01`;
  const dateValue = `${dd}/${mm}/${yyyy}`;
  const fromText = fromLabel || 'Origin Department';
  const toText = toLabel || 'Store / Procurement Department';
  const senderName = headName || '';
  const senderTitle = headTitle || '';

  return `
      <div style="font-family: 'Times New Roman', 'Georgia', serif; max-width: 750px; margin: 0 auto; padding: 30px 40px; color: #1a1a1a; background: white; border: 2px solid #1a3a6e; text-align: justify;">

        <!-- Company Logo (centered) immediately followed by the voucher title — the
             logo image already carries the company name, so no redundant text label below it -->
        <div style="text-align: center;">
          <img src="/logo.svg" style="display: block; margin: 0 auto; width: 64px; height: auto; border-radius: 8px;" />
        </div>

        <div style="text-align: center; margin: 8px 0 6px 0; font-size: 9px; color: #333; line-height: 1.5;">
          Km 10, Abuja-Keffi Expressway, Salamu Road, Gora, Nasarawa State &nbsp;|&nbsp;
          www.cssgroup.com.ng &nbsp;|&nbsp; info@cssgroup.com.ng &nbsp;|&nbsp; +234 702 603 3333
        </div>

        <!-- Voucher Title -->
        <div style="text-align: center; margin: 10px 0 18px 0;">
          <h2 style="font-size: 18px; font-weight: 900; font-style: italic; text-decoration: underline; letter-spacing: 3px; text-transform: uppercase; margin: 0; color: #1a1a1a;">Material Request</h2>
        </div>

        <!-- Header Fields — plain flex rows, not a <table>, so the editor's table extension
             (and its visual borders, meant for genuine data grids) never touches this purely
             positional layout. Labels match the PDF print record exactly. -->
        ${[
          ['Reference No:', `<span data-memo-ref>${refValue}</span>`],
          ['From:', `<span data-memo-from>${fromText}</span>`],
          ['To:', `<span data-memo-to>${toText}</span>`],
          ['Title:', `<span data-memo-subject style="font-weight:800;">[Enter request title here]</span>`],
          ['Type:', 'Material'],
          ['Urgency:', 'Normal'],
          ['Date:', `<span data-memo-date>${dateValue}</span>`],
        ].map(([label, value]) => `
        <div style="display: flex; align-items: baseline; margin-bottom: 4px; font-size: 13px;">
          <span style="width: 130px; font-weight: 800;">${label}</span>
          <span style="flex: 1; padding-bottom: 2px; border-bottom: 1px dotted #666;">${value}</span>
        </div>`).join('')}
        <div style="margin-bottom: 14px;"></div>

        <!-- Items Table — sample rows filled in as a guide -->
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #1a1a1a; margin-bottom: 18px;">
          <thead>
            <tr>
              <th style="border: 1.5px solid #1a1a1a; padding: 6px 4px; font-size: 12px; font-weight: 800; width: 40px; text-align: center;">S/N</th>
              <th style="border: 1.5px solid #1a1a1a; padding: 6px 4px; font-size: 12px; font-weight: 800; width: 60px; text-align: center;">Qty</th>
              <th style="border: 1.5px solid #1a1a1a; padding: 6px 8px; font-size: 12px; font-weight: 800; text-align: center;">Item Description</th>
              <th colspan="2" style="border: 1.5px solid #1a1a1a; padding: 2px 0 0 0; font-size: 12px; font-weight: 800; text-align: center;">
                <div style="padding: 4px; border-bottom: 1.5px solid #1a1a1a;">Amount</div>
                <div style="display: flex;">
                  <div style="flex: 1; padding: 3px; text-align: center; border-right: 1.5px solid #1a1a1a; font-size: 11px;">N</div>
                  <div style="flex: 1; padding: 3px; text-align: center; font-size: 11px;">K</div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #1a1a1a; padding: 10px 4px; text-align: center; font-size: 12px;">1</td><td style="border: 1px solid #1a1a1a; padding: 10px 4px; text-align: center; font-size: 12px;">5</td><td style="border: 1px solid #1a1a1a; padding: 10px 8px; font-size: 12px;">A4 Bond Paper (Ream)</td><td style="border: 1px solid #1a1a1a; padding: 10px 4px; width: 80px; text-align: right; font-size: 12px;">12,500</td><td style="border: 1px solid #1a1a1a; padding: 10px 4px; width: 45px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 10px 4px; text-align: center; font-size: 12px;">2</td><td style="border: 1px solid #1a1a1a; padding: 10px 4px; text-align: center; font-size: 12px;">2</td><td style="border: 1px solid #1a1a1a; padding: 10px 8px; font-size: 12px;">HP Toner Cartridge</td><td style="border: 1px solid #1a1a1a; padding: 10px 4px; text-align: right; font-size: 12px;">35,000</td><td style="border: 1px solid #1a1a1a; padding: 10px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 14px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 14px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 14px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 14px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 14px 4px;"></td></tr>
            <tr><td style="border: 1px solid #1a1a1a; padding: 14px 4px; text-align: center; font-size: 12px;">&nbsp;</td><td style="border: 1px solid #1a1a1a; padding: 14px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 14px 8px;"></td><td style="border: 1px solid #1a1a1a; padding: 14px 4px;"></td><td style="border: 1px solid #1a1a1a; padding: 14px 4px;"></td></tr>
            <!-- TOTAL Row -->
            <tr style="font-weight: 900;">
              <td colspan="3" style="border: 2px solid #1a1a1a; padding: 10px 8px; text-align: center; font-size: 14px; font-weight: 900; letter-spacing: 2px;">TOTAL</td>
              <td style="border: 2px solid #1a1a1a; padding: 10px 4px; text-align: right; font-size: 12px;">47,500</td>
              <td style="border: 2px solid #1a1a1a; padding: 10px 4px;"></td>
            </tr>
          </tbody>
        </table>

        <!-- Sender Signature Block — plain flex row, not a <table> -->
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 25px;">
          <div style="width: 48%;">
            <p style="font-weight: 800; margin: 0 0 2px 0; font-size: 13px;"><span data-memo-sender-name>${senderName}</span></p>
            <p style="margin: 0; color: #444; font-size: 11px;"><span data-memo-sender-title>${senderTitle}</span></p>
            <p style="margin: 6px 0 0 0; font-size: 11px;"><strong>Sign:</strong> <span style="border-bottom: 1px dotted #666; display: inline-block; width: 130px;"></span></p>
          </div>
          <div style="width: 48%; text-align: right;">
            <p style="font-weight: 800; margin: 0 0 2px 0; font-size: 13px;">Approved by:</p>
            <p style="margin: 6px 0 0 0; font-size: 11px;"><strong>Sign:</strong> <span style="border-bottom: 1px dotted #666; display: inline-block; width: 130px;"></span></p>
          </div>
        </div>
      </div>
    `;
};

export const templates = {
  memo: {
    title: "Internal Memo",
    sample: "e.g. Lodge Allocation Request to Facilities",
    data: buildMemoTemplate
  },
  materialRequest: {
    title: "Material Request",
    sample: "e.g. Office Stationery & Printer Consumables",
    data: buildMaterialRequestTemplate
  }
};
