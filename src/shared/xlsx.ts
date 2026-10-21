/**
 * 의존성 없는 최소 XLSX 읽기/쓰기.
 * - 읽기: ZIP(deflate-raw/store) + workbook/rels/sharedStrings/sheet XML
 * - 쓰기: store 방식 ZIP + inlineStr 셀
 * Chrome 110+의 DecompressionStream(deflate-raw)을 사용한다.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  ]);
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  offset: number;
  crc: number;
}

function buildZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const entries: ZipEntry[] = files.map((file) => {
    const name = textEncoder.encode(file.name);
    const data = textEncoder.encode(file.content);
    const crc = crc32(data);
    const entry: ZipEntry = { name: file.name, data, offset, crc };

    localParts.push(
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data
    );
    offset += 30 + name.length + data.length;
    return entry;
  });

  let centralSize = 0;
  for (const entry of entries) {
    const name = textEncoder.encode(entry.name);
    centralParts.push(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(entry.crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(entry.offset),
      name
    );
    centralSize += 46 + name.length;
  }

  const local = concat(localParts);
  const central = concat(centralParts);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(local.length),
    u16(0)
  ]);

  return concat([local, central, eocd]);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("이 브라우저에서는 XLSX 압축 해제를 지원하지 않습니다.");
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(
    new DecompressionStream("deflate-raw")
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(data: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = -1;
  for (let index = data.length - 22; index >= Math.max(0, data.length - 65557); index--) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("XLSX(ZIP) 파일이 아닙니다.");

  const count = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  let cursor = directoryOffset;

  for (let index = 0; index < count; index++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = textDecoder.decode(data.slice(cursor + 46, cursor + 46 + nameLength));

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      cursor += 46 + nameLength + extraLength + commentLength;
      continue;
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = data.slice(start, start + compressedSize);
    files.set(name.replace(/^\//, ""), method === 0 ? raw : await inflateRaw(raw));

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

function parseXml(source: Uint8Array): Document {
  if (typeof DOMParser === "undefined") {
    throw new Error("XML 파서를 사용할 수 없습니다.");
  }
  const text = textDecoder.decode(source);
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XLSX 내부 XML을 해석하지 못했습니다.");
  }
  return doc;
}

function nodeText(node: Element): string {
  return Array.from(node.getElementsByTagName("t"))
    .map((element) => element.textContent ?? "")
    .join("");
}

function cellText(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute("t") ?? "";
  if (type === "inlineStr") return nodeText(cell);
  const value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
  if (type === "s") {
    const index = Number(value);
    return Number.isInteger(index) ? sharedStrings[index] ?? "" : "";
  }
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return value;
}

function columnIndex(reference: string): number {
  const letters = reference.replace(/[^A-Z]/gi, "").toUpperCase();
  let value = 0;
  for (const letter of letters) value = value * 26 + (letter.charCodeAt(0) - 64);
  return Math.max(0, value - 1);
}

export async function readXlsxRows(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const files = await readZip(bytes);

  const sharedStrings: string[] = [];
  const shared = files.get("xl/sharedStrings.xml");
  if (shared) {
    const doc = parseXml(shared);
    sharedStrings.push(...Array.from(doc.getElementsByTagName("si")).map(nodeText));
  }

  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = files.get("xl/workbook.xml");
  const rels = files.get("xl/_rels/workbook.xml.rels");
  if (workbook && rels) {
    const sheet = parseXml(workbook).getElementsByTagName("sheet")[0];
    const relationId = sheet?.getAttribute("r:id") ?? sheet?.getAttribute("id") ?? "";
    const relation = Array.from(parseXml(rels).getElementsByTagName("Relationship")).find(
      (item) => item.getAttribute("Id") === relationId
    );
    const target = relation?.getAttribute("Target");
    if (target) {
      sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    }
  }

  const sheet = files.get(sheetPath);
  if (!sheet) throw new Error("XLSX에서 첫 번째 시트를 찾지 못했습니다.");

  const doc = parseXml(sheet);
  const rows: string[][] = [];
  for (const row of Array.from(doc.getElementsByTagName("row"))) {
    const values: string[] = [];
    for (const cell of Array.from(row.getElementsByTagName("c"))) {
      const reference = cell.getAttribute("r") ?? "";
      const index = reference ? columnIndex(reference) : values.length;
      while (values.length < index) values.push("");
      values[index] = cellText(cell, sharedStrings);
    }
    rows.push(values);
  }
  return rows;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, "&#10;");
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

export function writeXlsx(rows: string[][], sheetName = "상품"): Uint8Array {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, column) => {
          if (value === "") return "";
          const reference = `${columnName(column)}${rowIndex + 1}`;
          return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
            value
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(
        sheetName
      )}" sheetId="1" r:id="rId1"/></sheets></workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
    }
  ];

  return buildZip(files);
}
