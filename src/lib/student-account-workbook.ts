export type StudentAccountWorkbookRow = {
  number: number;
  name: string;
  email: string;
  temporaryPassword: string;
  className: string;
  studentNumber: string;
  status: string;
};

type WorkbookOptions = {
  schoolName: string;
  className: string;
  exportedAt: Date;
  rows: StudentAccountWorkbookRow[];
};

const MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function inlineCell(reference: string, value: unknown, style: number) {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference: string, value: number, style: number) {
  return `<c r="${reference}" s="${style}" t="n"><v>${value}</v></c>`;
}

function formatExportTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

export async function buildStudentAccountWorkbook({
  schoolName,
  className,
  exportedAt,
  rows,
}: WorkbookOptions): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const lastRow = Math.max(5, rows.length + 5);
  const dataRows = rows.map((row, index) => {
    const rowNumber = index + 6;
    const bodyStyle = index % 2 === 0 ? 4 : 5;
    const passwordStyle = row.temporaryPassword === "Reset diperlukan" ? 8 : 6;
    return `<row r="${rowNumber}" ht="22" customHeight="1">
      ${numberCell(`A${rowNumber}`, row.number, 7)}
      ${inlineCell(`B${rowNumber}`, row.name, bodyStyle)}
      ${inlineCell(`C${rowNumber}`, row.email, bodyStyle)}
      ${inlineCell(`D${rowNumber}`, row.temporaryPassword, passwordStyle)}
      ${inlineCell(`E${rowNumber}`, row.className, bodyStyle)}
      ${inlineCell(`F${rowNumber}`, row.studentNumber, bodyStyle)}
      ${inlineCell(`G${rowNumber}`, row.status, row.status === "Aktif" ? 9 : 10)}
    </row>`;
  }).join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="6" customWidth="1"/>
    <col min="2" max="2" width="30" customWidth="1"/>
    <col min="3" max="3" width="32" customWidth="1"/>
    <col min="4" max="4" width="24" customWidth="1"/>
    <col min="5" max="5" width="17" customWidth="1"/>
    <col min="6" max="6" width="18" customWidth="1"/>
    <col min="7" max="7" width="14" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="34" customHeight="1">${inlineCell("A1", "DATA AKUN SISWA", 1)}</row>
    <row r="2" ht="24" customHeight="1">${inlineCell("A2", schoolName, 2)}</row>
    <row r="3" ht="22" customHeight="1">${inlineCell("A3", `Kelas: ${className}  •  Diekspor: ${formatExportTime(exportedAt)} WIB`, 3)}</row>
    <row r="4" ht="30" customHeight="1">${inlineCell("A4", "RAHASIA — Password sementara hanya untuk distribusi resmi. Hapus file setelah digunakan.", 11)}</row>
    <row r="5" ht="26" customHeight="1">
      ${inlineCell("A5", "NO.", 12)}
      ${inlineCell("B5", "NAMA LENGKAP", 12)}
      ${inlineCell("C5", "EMAIL LOGIN", 12)}
      ${inlineCell("D5", "PASSWORD SEMENTARA", 12)}
      ${inlineCell("E5", "KELAS", 12)}
      ${inlineCell("F5", "NIS", 12)}
      ${inlineCell("G5", "STATUS AKUN", 12)}
    </row>
    ${dataRows}
  </sheetData>
  <autoFilter ref="A5:G${lastRow}"/>
  <mergeCells count="4"><mergeCell ref="A1:G1"/><mergeCell ref="A2:G2"/><mergeCell ref="A3:G3"/><mergeCell ref="A4:G4"/></mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>
</worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="7">
    <font><sz val="11"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="20"/><name val="Aptos Display"/></font>
    <font><b/><color rgb="FF17365D"/><sz val="13"/><name val="Aptos"/></font>
    <font><color rgb="FF53657A"/><sz val="10"/><name val="Aptos"/></font>
    <font><color rgb="FF26364A"/><sz val="10"/><name val="Aptos"/></font>
    <font><b/><color rgb="FF7F6000"/><sz val="10"/><name val="Aptos"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4F7FB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9E2F0"/></left><right style="thin"><color rgb="FFD9E2F0"/></right><top style="thin"><color rgb="FFD9E2F0"/></top><bottom style="thin"><color rgb="FFD9E2F0"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="13">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>AWExam</Application></Properties>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Data Akun Siswa</dc:title><dc:creator>AWExam</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${exportedAt.toISOString()}</dcterms:created></cp:coreProperties>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Akun Siswa" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", styles);
  zip.file("xl/worksheets/sheet1.xml", sheet);

  return zip.generateAsync({
    type: "blob",
    mimeType: MIME_TYPE,
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
