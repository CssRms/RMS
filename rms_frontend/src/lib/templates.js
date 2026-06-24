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

        <!-- CSS Group Logo (centered) immediately followed by the document title -->
        <div style="text-align: center; margin-bottom: 2px;">
          <img src="/logo.svg" style="display: block; margin: 0 auto 4px auto; width: 60px; height: auto; border-radius: 8px;" />
          <div style="font-size: 16px; font-weight: 800; letter-spacing: 2px; color: #333;">CSS</div>
          <div style="font-size: 10px; color: #666; letter-spacing: 1px;">Group</div>
        </div>

        <div style="text-align: center; margin: 6px 0 22px 0;">
          <h2 style="font-size: 16px; font-weight: 800; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Internal Memo</h2>
        </div>

        <!-- Header Fields Block -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 13px;">
          <tr>
            <td style="width: 85px; font-weight: 800; padding: 5px 0; vertical-align: top; text-transform: uppercase;">Ref:</td>
            <td style="padding: 5px 0; border-bottom: 1px solid #999;"><span data-memo-ref>${ref}</span></td>
            <td style="width: 60px;"></td>
            <td style="width: 180px; font-weight: 800; text-align: right; padding: 5px 0; border-bottom: 1px solid #999;"><span data-memo-date>${memoDate}</span></td>
          </tr>
        </table>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 13px;">
          <tr>
            <td style="width: 85px; font-weight: 800; padding: 4px 0; text-transform: uppercase;">To:</td>
            <td style="padding: 4px 0; font-weight: 700;"><span data-memo-to>${toText}</span></td>
          </tr>
          <tr>
            <td style="width: 85px; font-weight: 800; padding: 4px 0; text-transform: uppercase;">From:</td>
            <td style="padding: 4px 0;"><span data-memo-from>${fromText}</span></td>
          </tr>
          <tr>
            <td style="width: 85px; font-weight: 800; padding: 4px 0; vertical-align: top; text-transform: uppercase;">Subject:</td>
            <td style="padding: 4px 0; font-weight: 800; border-bottom: 2px solid #333;"><span data-memo-subject>${subjectText}</span></td>
          </tr>
        </table>

        <hr style="border: none; border-top: 1px solid #333; margin: 8px 0 20px 0;" />

        <!-- Body Content -->
        <div style="font-size: 13px; line-height: 1.7; min-height: 300px; text-align: justify;">
          <p style="text-indent: 40px; margin: 0 0 15px 0; text-align: justify;">Following the requests received from Prof. Eric Alao and Prof. I.E Ahaneku for Students Industrial Work Experience Scheme (SIWES) placement for:</p>

          <ol style="padding-left: 25px; margin: 0 0 20px 0; text-align: justify;">
            <li style="margin-bottom: 8px;">Alao Danies Omotayo: A 400-level Agricultural & Bio-systems Engineering student from Landmark University.</li>
            <li style="margin-bottom: 8px;">Agomuo George Chidike: An Agricultural and Bio-resources Engineering student from Michael Okpara University of Agriculture, Umudike.</li>
          </ol>

          <p style="text-indent: 40px; margin: 0 0 15px 0; text-align: justify;">I hereby write for allocation of one room in the staff lodge for these two students, to enable them resume by second week of April, 2026.</p>

          <p style="text-indent: 40px; margin: 0 0 15px 0; text-align: justify;">Attached to this memo are the official letters of introduction and placement reservation requests for your consideration.</p>
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

        <!-- Company Logo (centered) immediately followed by the voucher title -->
        <div style="text-align: center; margin-bottom: 2px;">
          <img src="/logo.svg" style="display: block; margin: 0 auto 4px auto; width: 60px; height: auto; border-radius: 8px;" />
          <div style="font-size: 20px; font-weight: 900; color: #1a3a6e; letter-spacing: 1px; line-height: 1;">CSS</div>
          <div style="font-size: 9px; font-weight: 700; color: #1a3a6e; letter-spacing: 0.5px;">Group of Companies</div>
        </div>

        <div style="text-align: center; margin: 8px 0 6px 0; font-size: 9px; color: #333; line-height: 1.5;">
          Km 10, Abuja-Keffi Expressway, Salamu Road, Gora, Nasarawa State &nbsp;|&nbsp;
          www.cssgroup.com.ng &nbsp;|&nbsp; info@cssgroup.com.ng &nbsp;|&nbsp; +234 702 603 3333
        </div>

        <!-- Voucher Title -->
        <div style="text-align: center; margin: 10px 0 18px 0;">
          <h2 style="font-size: 18px; font-weight: 900; font-style: italic; text-decoration: underline; letter-spacing: 3px; text-transform: uppercase; margin: 0; color: #1a1a1a;">Material Request</h2>
        </div>

        <!-- Header Fields — match the PDF print record labels exactly -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13px;">
          <tr>
            <td style="width: 130px; font-weight: 800; padding: 4px 0;">Reference No:</td>
            <td style="padding: 4px 0; border-bottom: 1px dotted #666;"><span data-memo-ref>${refValue}</span></td>
          </tr>
          <tr>
            <td style="width: 130px; font-weight: 800; padding: 4px 0;">From:</td>
            <td style="padding: 4px 0; border-bottom: 1px dotted #666;"><span data-memo-from>${fromText}</span></td>
          </tr>
          <tr>
            <td style="width: 130px; font-weight: 800; padding: 4px 0;">To:</td>
            <td style="padding: 4px 0; border-bottom: 1px dotted #666;"><span data-memo-to>${toText}</span></td>
          </tr>
          <tr>
            <td style="width: 130px; font-weight: 800; padding: 4px 0;">Title:</td>
            <td style="padding: 4px 0; font-weight: 800; border-bottom: 1px dotted #666;"><span data-memo-subject>[Enter request title here]</span></td>
          </tr>
          <tr>
            <td style="width: 130px; font-weight: 800; padding: 4px 0;">Type:</td>
            <td style="padding: 4px 0; border-bottom: 1px dotted #666;">Material</td>
          </tr>
          <tr>
            <td style="width: 130px; font-weight: 800; padding: 4px 0;">Urgency:</td>
            <td style="padding: 4px 0; border-bottom: 1px dotted #666;">Normal</td>
          </tr>
          <tr>
            <td style="width: 130px; font-weight: 800; padding: 4px 0;">Date:</td>
            <td style="padding: 4px 0; border-bottom: 1px dotted #666;"><span data-memo-date>${dateValue}</span></td>
          </tr>
        </table>

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

        <!-- Sender Signature Block -->
        <table style="width: 100%; font-size: 12px; margin-top: 25px;">
          <tr>
            <td style="width: 50%; padding: 8px 0; vertical-align: top;">
              <p style="font-weight: 800; margin: 0 0 2px 0; font-size: 13px;"><span data-memo-sender-name>${senderName}</span></p>
              <p style="margin: 0; color: #444; font-size: 11px;"><span data-memo-sender-title>${senderTitle}</span></p>
              <p style="margin: 6px 0 0 0; font-size: 11px;"><strong>Sign:</strong> <span style="border-bottom: 1px dotted #666; display: inline-block; width: 130px;"></span></p>
            </td>
            <td style="width: 50%; text-align: right; padding: 8px 0; vertical-align: top;">
              <p style="font-weight: 800; margin: 0 0 2px 0; font-size: 13px;">Approved by:</p>
              <p style="margin: 6px 0 0 0; font-size: 11px;"><strong>Sign:</strong> <span style="border-bottom: 1px dotted #666; display: inline-block; width: 130px;"></span></p>
            </td>
          </tr>
        </table>
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
