// กำหนดชื่อชีตที่จะใช้บันทึกข้อมูล
const SHEET_NAME = "data";
// (ใหม่) กำหนดชื่อโฟลเดอร์สำหรับเก็บไฟล์หลักฐาน
const EVIDENCE_FOLDER_NAME = "Communication_Evidence_Uploads";
// (ใหม่) กำหนดชื่อโฟลเดอร์สำหรับเก็บ PDF
const PDF_FOLDER_NAME = "Communication_Reports_PDF";

/**
 * [doGet] - ฟังก์ชันที่ใช้แสดงผล HTML เมื่อเข้าถึง Web App URL
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ระบบรายงานแผนการสื่อสารผู้บริหาร')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===================================================================
// === 🚀 (ส่วนที่ 1) ฟังก์ชันสร้าง PDF (เวอร์ชันอัปเดต) 🚀 ===
// ===================================================================

/**
 * [🚀 ฟังก์ชันใหม่ 🚀] - ดึงรูปภาพจาก Drive ID แล้วแปลงเป็น Data URI (Base64)
 * เพื่อให้สามารถฝังใน <img> tag และแสดงผลใน PDF ที่สร้างจาก HTML ได้
 */
function getImageAsDataUri(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const mimeType = blob.getContentType();
    
    // ตรวจสอบว่าเป็นรูปภาพที่รองรับหรือไม่
    if (!mimeType.startsWith("image/")) {
      return null; // ไม่ใช่รูปภาพ
    }
    
    const base64Data = Utilities.base64Encode(blob.getBytes());
    return `data:${mimeType};base64,${base64Data}`;
  } catch (e) {
    Logger.log(`Failed to get image as data URI for ID ${fileId}: ${e.message}`);
    // ส่ง URL รูปภาพสำรอง (Placeholder) กรณีเกิดข้อผิดพลาด
    return 'https://placehold.co/80x80/eeeeee/c9c9c9?text=Image+Error';
  }
}

/**
 * [generatePdfBlob] - สร้าง PDF Blob จาก formData
 * (เวอร์ชันแก้ไขให้แสดงรูปภาพ)
 */
function generatePdfBlob(formData) {
  try {
    // 1. ดึงข้อมูลประเด็นการสื่อสาร (JSON)
    let topicsData = [];
    try {
      topicsData = JSON.parse(formData.communication_topics_json || '[]');
    } catch (e) {
      Logger.log("Error parsing JSON in generatePdfBlob: " + e);
    }

    // 2. สร้างแถวในตาราง (tbody)
    let tableBodyHtml = '';
    topicsData.forEach((topic) => {
      const executiveName = `${formData.executive_name} ${formData.executive_surname}`;

      // --- ( 🚀 นี่คือโค้ดใหม่ที่แก้ไขให้แสดงรูปภาพ 🚀 ) ---
      let evidenceText = 'ไม่มี';
      if (Array.isArray(topic.evidenceFiles) && topic.evidenceFiles.length > 0) {
        evidenceText = topic.evidenceFiles.map(f => {
          if (!f || !f.name || !f.url) {
            return 'ไฟล์มีปัญหา';
          }
   
          const lowerName = f.name.toLowerCase();

          // 1. ถ้าเป็นรูปภาพ (ใช้ Data URI)
          if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') || lowerName.endsWith('.gif')) {
            
            // (ใหม่) ดึง File ID จาก URL (เช่น ...uc?id=FILE_ID)
            const fileIdMatch = f.url.match(/id=([^&]+)/);
       
            if (fileIdMatch && fileIdMatch[1]) {
              const fileId = fileIdMatch[1];
              // (ใหม่) เรียกฟังก์ชัน helper เพื่อเอา Data URI
              const dataUri = getImageAsDataUri(fileId);
              if (dataUri) {
                return `
                  <a href="${f.url}" target="_blank" title="${f.name}" style="display: inline-block; margin: 3px;">
                    <img src="${dataUri}" alt="${f.name}" style="width: 80px; height: 80px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px;"
                  />
                  </a>
                `;
              }
            }
          } 
          // 2. ถ้าเป็น PDF หรือไฟล์อื่น (สร้างเป็นลิงก์)
          return `<a href="${f.url}" target="_blank" style="color: #0000ee; text-decoration: underline; font-size: 10pt;">📄 ${f.name}</a>`;
        }).join('');
      }
      // --- ( 🚀 สิ้นสุดโค้ดใหม่ 🚀 ) ---

      const selectedTopics = (topic.selectedTopics || []).join(', ');
      const details = topic.details || '-';
      const allChannels = [...(topic.internalChannels || []), ...(topic.externalChannels || [])].join(', ');
      const allAudience = [...(topic.internalAudience || []), ...(topic.externalAudience || [])].join(', ');
      tableBodyHtml += `
        <tr>
          <td>${executiveName}</td>
          <td><strong>${selectedTopics}</strong><hr style="margin: 4px 0;"><p class="topic-detail-text">${details}</p></td>
          <td>${allChannels}</td>
          <td>${allAudience}</td>
          <td>${evidenceText}</td>
        </tr>
      `;
    });

    // (ส่วนที่ 3, 4, 5, 6 - โค้ด HTML, CSS, และการสร้าง Blob เหมือนเดิมทุกประการ)
    const recorderName = `${formData.recorder_name || ''} ${formData.recorder_surname || ''}`;
    const recorderPosition = formData.recorder_position || '...';
    const recorderAffiliation = formData.recorder_affiliation || '...';
    const recorderDepartment = formData.recorder_department || '...';
    const recorderPhone = formData.recorder_phone || '...';
    
    // ================================================================
    // === 🚀🚀🚀 จุดที่ 1: (แก้ไข) โค้ด CSS (Mitr 18/16/14pt) 🚀🚀🚀 ===
    // ================================================================
    const css = `
      <style>
        @page { size: A4 landscape; margin: 0.75in; }
        
        body { 
          font-family: 'Mitr', sans-serif;
          font-size: 16pt;
          line-height: 1.4;
          font-weight: normal;
        }
        h2, h3 {
          font-size: 18pt;
          font-weight: bold;
          text-align: center;
          margin: 0 0 5px 0;
        }
        h3 { margin: 0 0 15px 0; }
        
        .recorder-info {
          font-size: 16pt;
          margin-bottom: 10px;
          line-height: 1.5;
          word-wrap: break-word;
        }
        .recorder-info strong { font-weight: bold; }

        .print-table { 
          width: 100%;
          border-collapse: collapse;
          font-size: 14pt;
          table-layout: fixed;
          margin-top: 15px;
        }
        .print-table th, .print-table td { 
          border: 1px solid #000;
          padding: 6px;
          text-align: left;
          vertical-align: top;
          word-wrap: break-word;
        }
        .print-table th { 
          background-color: #eee;
          text-align: center;
          font-weight: bold;
        }
        .print-table img { width: 80px !important; height: 80px !important; object-fit: cover; }
        .print-table p.topic-detail-text {
          font-size: 12pt;
          white-space: pre-wrap;
          margin: 0;
          padding: 0;
        }

        .footer-section {
          font-size: 16pt;
          margin-top: 15px;
        }
        .footer-section strong { font-weight: bold; }
        .footer-section span {
          font-weight: normal;
          white-space: pre-wrap;
          padding-left: 10px;
        }
        
        .signature-div {
          width: 100%;
          text-align: right;
          font-size: 16pt;
          font-weight: bold;
        }
        .signature-div p { 
          margin: 5px 0;
          padding: 0;
          text-align: center;
          width: 300px;
          margin-left: auto;
          margin-right: 0;
        }

        .pdf-footer {
          position: fixed; 
          bottom: 0;
          left: 0;
          width: 100%;
          background-color: #1976d2; 
          color: #ffffff;
          padding: 10px 0; 
          text-align: center;
          font-size: 10pt; 
          font-weight: normal;
        }
      </style>
    `;
    
    // ================================================================
    // === 🚀🚀🚀 จุดที่ 2: (แก้ไข) โค้ด HTML (Layout ต่อท้าย) 🚀🚀🚀 ===
    // ================================================================
    const printHtml = `
      <h2>รายงานการสื่อสารตามแผนการสื่อสารภายในและภายนอกองค์กรของผู้บริหาร ประจำปีงบประมาณ 2569</h2>
      <h3>ประจำเดือน ${formData.communication_month}</h3>
      
      <div class="recorder-info">
          <strong>ผู้จัดทำรายงาน:</strong> ${recorderName} &nbsp;&nbsp;
          <strong>ตำแหน่ง:</strong> ${recorderPosition} &nbsp;&nbsp;
          <strong>สายงาน/หน่วยงาน:</strong> ${recorderAffiliation} / ${recorderDepartment} &nbsp;&nbsp;
          <strong>โทรศัพท์:</strong> ${recorderPhone}
      </div>
      
      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 15%;">ผู้ถ่ายทอดสาร</th>
            <th style="width: 30%;">ประเด็นการสื่อสาร</th>
            <th style="width: 20%;">ช่องทางการสื่อสาร</th>
            <th style="width: 20%;">ผู้รับสาร</th>
            <th style="width: 15%;">หลักฐาน (ถ้ามี)</th>
          </tr>
        </thead>
        <tbody>
          ${tableBodyHtml}
        </tbody>
      </table>
      
      <div class="footer-section">
          <div style="margin-bottom: 5px;">
            <strong>ปัญหาและอุปสรรคในการสื่อสาร:</strong>
            <span>${formData.problems_obstacles || '-'}</span>
          </div>
          <div>
            <strong>ข้อเสนอแนะของผู้บริหารในการสื่อสาร:</strong>
            <span>${formData.executive_suggestions || '-'}</span>
          </div>
      </div>
      
      <br><br><br>
      
      <div class="signature-div">
          <p>${formData.executive_name || ''} ${formData.executive_surname || ''}</p>
          <p>${formData.executive_position || '...'}</p>
      </div>
      
      <div class="pdf-footer">
          ส่วนข้อมูลข่าวสารและประเมินผลการสื่อสาร กองบริหารภาพลักษณ์และแผนการสื่อสาร ฝ่ายสื่อสารองค์กร โทร. 1269
      </div>
      `;
      
    const fullHtml = `<!doctype html><html><head>
    <link href="https://fonts.googleapis.com/css?family=Mitr:400,700&display=swap" rel="stylesheet">
    ${css}
    </head><body>${printHtml}</body></html>`;
    
    const htmlBlob = Utilities.newBlob(fullHtml, 'text/html', 'report.html');
    const pdfBlob = htmlBlob.getAs('application/pdf').setName(`Report-${formData.id}.pdf`);

    return pdfBlob;
  } catch (e) {
    Logger.log("Error in generatePdfBlob: " + e.message);
    return null;
  }
}

// ===================================================================
// === (ส่วนที่ 2) ฟังก์ชัน saveData (เพิ่มการสร้าง Header อัตโนมัติ) ===
// ===================================================================

function saveData(formData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet name "${SHEET_NAME}" not found. Please create a sheet named "data" (lowercase).`);
    }

    // 🚀 เพิ่มระบบสร้างหัวตารางอัตโนมัติ 🚀
    // หากเพิ่งเคลียร์ชีตจนว่างเปล่า ระบบจะพิมพ์หัวตารางให้ก่อน 1 บรรทัด
    if (sheet.getLastRow() === 0) {
      const headers = [
        'id', 'created_date', 'recorder_name', 'recorder_surname',
        'recorder_position', 'recorder_affiliation', 'recorder_department',
        'recorder_phone', 'recorder_email', 'communication_month',
        'executive_name', 'executive_surname', 'executive_position',
        'executive_affiliation', 'executive_department',
        'communication_topics_json', 'problems_obstacles', 'executive_suggestions'
      ];
      sheet.appendRow(headers);
    }

    const newRow = [
      formData.id, formData.created_date, formData.recorder_name, formData.recorder_surname,
      formData.recorder_position, formData.recorder_affiliation, formData.recorder_department,
      formData.recorder_phone, formData.recorder_email, formData.communication_month,
      formData.executive_name, formData.executive_surname, formData.executive_position,
      formData.executive_affiliation, formData.executive_department,
      formData.communication_topics_json, formData.problems_obstacles, formData.executive_suggestions
    ];
    sheet.appendRow(newRow);

    const pdfBlob = generatePdfBlob(formData);
    const folder = getOrCreateFolder(PDF_FOLDER_NAME);
    const fileName = `[รายงาน] ${formData.communication_month} - ${formData.executive_name} ${formData.executive_surname}.pdf`;
    pdfBlob.setName(fileName);
    const pdfFile = folder.createFile(pdfBlob);
    Logger.log(`PDF Report saved to Drive: ${pdfFile.getUrl()}`);
    
    sendConfirmationEmail(formData, pdfBlob);

    return JSON.stringify({ status: 'success' });
  } catch (error) {
    Logger.log(error);
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

// ===================================================================
// === (ส่วนที่ 3) ฟังก์ชัน sendConfirmationEmail ===
// ===================================================================
function sendConfirmationEmail(data, pdfAttachment) {
  try {
    const recipientEmail = data.recorder_email;
    const recipientName = `${data.recorder_name} ${data.recorder_surname} (${data.recorder_position})`;
    const executiveName = `${data.executive_name} ${data.executive_surname} (${data.executive_position})`;
    const communicationMonth = data.communication_month;
    const dateString = String(data.created_date);
    let datePart, timePart;
    if (dateString.includes(',')) {
      [datePart, timePart] = dateString.split(',').map(s => s.trim());
    } else {
      [datePart, timePart] = dateString.split(' ');
    }
    const [day, month, yearBEString] = datePart.split('/');
    const yearCE = parseInt(yearBEString) - 543;
    const dateObject = new Date(`${yearCE}/${month}/${day} ${timePart}`);
    const timezone = Session.getScriptTimeZone();
    const dateStrCE = Utilities.formatDate(dateObject, timezone, 'd MMMM');
    const timeStr = Utilities.formatDate(dateObject, timezone, 'HH:mm น.');
    const formattedDate = `วันที่ ${dateStrCE} ${yearBEString}, เวลา ${timeStr}`;
    const subject = `ยืนยืนการส่งรายงานการสื่อสาร (${executiveName}) เดือน ${communicationMonth}`;
    const body = `
    สวัสดีครับคุณ ${recipientName},

    ส่วนข้อมูลข่าวสารและประเมินผลการสื่อสาร กองบริหารภาพลักษณ์และแผนการสื่อสาร ฝ่ายสื่อสารองค์กร ได้รับข้อมูลการส่งรายงานการสื่อสารภายในและภายนอกองค์กรสำหรับผู้บริหาร ประจำปีงบประมาณ 2569 ที่ท่านได้บันทึกไว้เรียบร้อยแล้ว
    
    (เอกสาร PDF รายงานฉบับเต็มได้ถูกแนบมาในอีเมลนี้แล้ว)
    
    รายละเอียดโดยย่อ:
    - ผู้บริหาร: ${executiveName}
    - เดือนที่สื่อสาร: ${communicationMonth}
    - ผู้บันทึก: ${recipientName} (${recipientEmail})
 
    ส่วนข้อมูลข่าวสารและประเมินผลการสื่อสาร กองบริหารภาพลักษณ์และแผนการสื่อสาร ฝ่ายสื่อสารองค์กร ขอขอบคุณที่ส่งรายงานการสื่อสารภายในและภายนอกองค์กรสำหรับผู้บริหาร ประจำปีงบประมาณ 2569
    
    (นี่คืออีเมลอัตโนมัติ กรุณาอย่าตอบกลับ)
    `;
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: body,
      attachments: [pdfAttachment]
    });
  } catch (error) {
    Logger.log('Failed to send email: ' + error.message);
  }
}

// ===================================================================
// === 🚀 (ส่วนที่ 4) ฟังก์ชัน getSheetData (แก้ไขให้อ่านข้อมูลแม่นยำขึ้น) 🚀 ===
// ===================================================================
function getSheetData() {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      
      // ถ้าไม่มีชีต หรือชีตว่างเปล่าสนิท ให้คืนค่าว่างกลับไป
      if (!sheet || sheet.getLastRow() === 0) {
          return JSON.stringify({ status: 'success', data: [], headers: [] });
      }
      
      const range = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn());
      const values = range.getDisplayValues();
      
      let headers = [];
      let data = [];
      
      // 🚀 ตรวจสอบว่า "แถวที่ 1" ดันเป็นข้อมูล (ID ขึ้นต้นด้วย rec_) หรือไม่
      // กรณีที่ผู้ใช้เซฟข้อมูลตอนชีตว่างเปล่าและไม่มีหัวตาราง
      if (values.length > 0 && String(values[0][0]).startsWith('rec_')) {
         // ถ้าแถวแรกคือข้อมูลทั้งหมด ให้กำหนดหัวตารางจำลองขึ้นมาเอง
         headers = [
           'id', 'created_date', 'recorder_name', 'recorder_surname',
           'recorder_position', 'recorder_affiliation', 'recorder_department',
           'recorder_phone', 'recorder_email', 'communication_month',
           'executive_name', 'executive_surname', 'executive_position',
           'executive_affiliation', 'executive_department',
           'communication_topics_json', 'problems_obstacles', 'executive_suggestions'
         ];
         data = values; // นำข้อมูลทุกแถวไปใช้งานได้เลย
      } else {
         // ถ้าแถวแรกเป็น หัวตาราง ปกติ
         headers = values[0];
         data = values.slice(1); // ตัดแถวแรกทิ้ง แล้วเอาข้อมูลที่เหลือไปแสดง
      }
      
      return JSON.stringify({ status: 'success', data: data, headers: headers });
    } catch (error) {
        Logger.log(error);
        return JSON.stringify({ status: 'error', message: error.message });
    }
}

function deleteData(id) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const rowIndex = findRowById(sheet, id);
    if (rowIndex === -1) {
      throw new Error('ไม่พบข้อมูลที่ต้องการลบ (ID: ' + id + ')');
    }
    sheet.deleteRow(rowIndex);
    return JSON.stringify({ status: 'success', message: 'ลบข้อมูลเรียบร้อยแล้ว', id: id });
  } catch (error) {
    Logger.log(error);
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

function getRecordById(id) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const rowIndex = findRowById(sheet, id);
    if (rowIndex === -1) {
      throw new Error('ไม่พบข้อมูล (ID: ' + id + ')');
    }
    const range = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn());
    const data = range.getDisplayValues()[0];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const record = {};
    headers.forEach((header, index) => {
       record[header] = data[index];
     });
    if (!record['communication_topics_json'] || !record['executive_name']) {
       Logger.log("getRecordById: Headers ใน Sheet อาจไม่ตรงกับที่คาดหวัง");
       const keys = [
         'id', 'created_date', 'recorder_name', 'recorder_surname',
         'recorder_position', 'recorder_affiliation', 'recorder_department',
         'recorder_phone', 'recorder_email', 'communication_month',
         'executive_name', 'executive_surname', 'executive_position',
         'executive_affiliation', 'executive_department',
         'communication_topics_json', 'problems_obstacles', 'executive_suggestions'
       ];
       Object.keys(record).forEach(key => delete record[key]);
       keys.forEach((key, index) => {
         if(data[index] !== undefined) {
           record[key] = data[index];
         }
       });
    }

    return JSON.stringify({ status: 'success', data: record });
  } catch (error) {
    Logger.log(error);
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

function updateData(formData) {
   try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const rowIndex = findRowById(sheet, formData.id);
    if (rowIndex === -1) {
      throw new Error('ไม่พบข้อมูลที่ต้องการอัปเดต (ID: ' + formData.id + ')');
    }
    const updatedRow = [
      formData.id, formData.created_date, formData.recorder_name, formData.recorder_surname,
      formData.recorder_position, formData.recorder_affiliation, formData.recorder_department,
      formData.recorder_phone, formData.recorder_email, formData.communication_month,
      formData.executive_name, formData.executive_surname, formData.executive_position,
      formData.executive_affiliation, formData.executive_department,
      formData.communication_topics_json, formData.problems_obstacles, formData.executive_suggestions
    ];
    const range = sheet.getRange(rowIndex, 1, 1, updatedRow.length);
    range.setValues([updatedRow]);
    return JSON.stringify({ status: 'success', message: 'อัปเดตข้อมูลเรียบร้อยแล้ว' });
  } catch (error) {
    Logger.log(error);
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

function findRowById(sheet, id) {
  const columnAValues = sheet.getRange("A:A").getValues();
  for (let i = 0; i < columnAValues.length; i++) {
    if (columnAValues[i][0] == id) {
      return i + 1;
    }
  }
  return -1;
}

// ===================================================================
// === (🚀 ส่วนที่ 5) ฟังก์ชันสำหรับปุ่ม "ส่งออก PDF" ===
// ===================================================================
function generatePdfForRecordId(recordId, fileName) {
  try {
    const recordResponse = getRecordById(recordId);
    const recordResult = JSON.parse(recordResponse);
    if (recordResult.status !== 'success') {
      throw new Error('ไม่พบข้อมูล (ID: ' + recordId + ')');
    }
    
    const formData = recordResult.data;
    const pdfBlob = generatePdfBlob(formData);
    if (pdfBlob === null) {
      throw new Error("เกิดข้อผิดพลาดในการสร้าง PDF Blob (อาจจะมาจาก generatePdfBlob)");
    }
    
    pdfBlob.setName(fileName + '.pdf');

    const folder = getOrCreateFolder(PDF_FOLDER_NAME);
    const pdfFile = folder.createFile(pdfBlob);
    
    return JSON.stringify({ status: 'success', url: pdfFile.getUrl() });
  } catch (error) {
    Logger.log('Error in generatePdfForRecordId: ' + error.message);
    Logger.log(error.stack);
    return JSON.stringify({ status: 'error', message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์: " + error.message });
  }
}

// ===================================================================
// === 🚀 (ส่วนที่ 6) ฟังก์ชันอัปโหลดไฟล์ ===
// ===================================================================
function uploadFiles(filesArray) {
  try {
    const folder = getOrCreateFolder(EVIDENCE_FOLDER_NAME);
    const urls = [];

    filesArray.forEach(fileObject => {
      const mimeType = fileObject.data.substring(5, fileObject.data.indexOf(';'));
      const base64Data = fileObject.data.substring(fileObject.data.indexOf(',') + 1);
      const decodedData = Utilities.base64Decode(base64Data, Utilities.Charset.UTF_8);
      const blob = Utilities.newBlob(decodedData, mimeType, fileObject.filename);
      const file = folder.createFile(blob);
      
      urls.push({
        topicIndex: fileObject.topicIndex,
        url: 'https://drive.google.com/uc?id=' + file.getId(), 
        name: file.getName()
      });
    });
    return JSON.stringify({ status: 'success', urls: urls });
  } catch (error) {
    Logger.log(error);
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

// ===================================================================
// === (ฟังก์ชัน Config) ===
// ===================================================================
function getDepartmentData() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
    if (!sheet) {
      throw new Error("ไม่พบชีต 'Config' สำหรับดึงข้อมูล Dropdown");
    }
    const dataValues = sheet.getDataRange().getValues();
    const departmentData = {};
    dataValues.forEach(row => {
      if (row[0]) {
        const affiliation = row[0];
        const departments = row.slice(1).filter(String);
        departmentData[affiliation] = departments;
      }
    });
    return departmentData;
  } catch (e) {
    Logger.log("Error in getDepartmentData: " + e.message);
    throw new Error("GAS Error: " + e.message); 
  }
}

// ===================================================================
// === 🚀 ตัวจัดการ API สำหรับรับ Request จาก GitHub (Frontend) 🚀 ===
// ===================================================================
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload;
    
    let result = "";

    if (action === "getDepartmentData") {
      result = JSON.stringify({ status: 'success', data: getDepartmentData() });
    } 
    else if (action === "getSheetData") {
      result = getSheetData(); 
    } 
    else if (action === "saveData") {
      result = saveData(payload);
    } 
    else if (action === "uploadFiles") {
      result = uploadFiles(payload);
    } 
    else if (action === "deleteData") {
      result = deleteData(payload);
    } 
    else if (action === "generatePdfForRecordId") {
      result = generatePdfForRecordId(payload.recordId, payload.fileName);
    }

    return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
