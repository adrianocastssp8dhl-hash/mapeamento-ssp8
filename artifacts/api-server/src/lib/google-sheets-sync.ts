import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();
const SPREADSHEET_ID = "1f93l-8dyS3qdXrShhbJxuP1TT3DvFrY5nhGM7TGzt3g";
const APP_SHEET_TITLE = "BIPAGENS DO APP";
const APP_SHEET_RANGE = `'${APP_SHEET_TITLE}'!A:F`;

export class GoogleSheetsSyncError extends Error {
  constructor() {
    super("Não foi possível sincronizar com o Google Sheets. A operação foi cancelada; tente novamente.");
    this.name = "GoogleSheetsSyncError";
  }
}

export type SheetScan = {
  id: number;
  collaboratorId: number;
  collaboratorName: string;
  productId: string;
  quantity: number;
  scannedAt: Date | string;
};

type SpreadsheetResponse = {
  properties?: { timeZone?: string };
  sheets?: Array<{
    properties?: {
      title?: string;
      sheetId?: number;
      gridProperties?: { rowCount?: number };
    };
  }>;
};

type ValuesResponse = { values?: Array<Array<string | number>> };

type SheetConfig = { sheetId: number; rowCount: number; timeZone: string };

async function sheetsApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  try {
    const response = await connectors.proxy("google-sheet", path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw new GoogleSheetsSyncError();
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  } catch (error) {
    if (error instanceof GoogleSheetsSyncError) throw error;
    throw new GoogleSheetsSyncError();
  }
}

async function getSheetConfig(): Promise<SheetConfig> {
  const workbook = await sheetsApi<SpreadsheetResponse>(
    `/v4/spreadsheets/${SPREADSHEET_ID}?fields=properties(timeZone),sheets(properties(sheetId,title,gridProperties(rowCount)))`,
  );
  const properties = workbook.sheets?.find(
    (sheet) => sheet.properties?.title === APP_SHEET_TITLE,
  )?.properties;
  if (
    properties?.sheetId === undefined ||
    !properties.gridProperties?.rowCount ||
    !workbook.properties?.timeZone
  ) {
    throw new GoogleSheetsSyncError();
  }
  return {
    sheetId: properties.sheetId,
    rowCount: properties.gridProperties.rowCount,
    timeZone: workbook.properties.timeZone,
  };
}

async function readRows(): Promise<Array<Array<string | number>>> {
  const response = await sheetsApi<ValuesResponse>(
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(APP_SHEET_RANGE)}`,
  );
  return response.values ?? [];
}

function toSheetSerial(value: Date | string, timeZone: string): number {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new GoogleSheetsSyncError();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  const localAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
    date.getUTCMilliseconds(),
  );
  return localAsUtc / 86_400_000 + 25_569;
}

function scanCells(scan: SheetScan, timeZone: string) {
  return [
    { userEnteredValue: { stringValue: String(scan.id) } },
    { userEnteredValue: { stringValue: String(scan.collaboratorId) } },
    { userEnteredValue: { stringValue: scan.collaboratorName } },
    { userEnteredValue: { stringValue: scan.productId } },
    { userEnteredValue: { numberValue: scan.quantity } },
    { userEnteredValue: { numberValue: toSheetSerial(scan.scannedAt, timeZone) } },
  ];
}

async function writeScan(scan: SheetScan, rowIndex: number, config: SheetConfig): Promise<void> {
  await sheetsApi(
    `/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    "POST",
    {
      requests: [
        ...(rowIndex >= config.rowCount
          ? [{
              appendDimension: {
                sheetId: config.sheetId,
                dimension: "ROWS",
                length: rowIndex - config.rowCount + 1,
              },
            }]
          : []),
        {
          updateCells: {
            start: { sheetId: config.sheetId, rowIndex, columnIndex: 0 },
            rows: [{ values: scanCells(scan, config.timeZone) }],
            fields: "userEnteredValue",
          },
        },
      ],
    },
  );
}

function findScanRow(rows: Array<Array<string | number>>, scanId: number): number {
  const matches: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    if (String(rows[index][0] ?? "") === String(scanId)) matches.push(index);
  }
  if (matches.length !== 1) throw new GoogleSheetsSyncError();
  return matches[0];
}

export async function syncCreateScan(scan: SheetScan): Promise<void> {
  const [config, rows] = await Promise.all([getSheetConfig(), readRows()]);
  await writeScan(scan, Math.max(1, rows.length), config);
}

export async function syncUpdateScan(scan: SheetScan): Promise<void> {
  const [config, rows] = await Promise.all([getSheetConfig(), readRows()]);
  await writeScan(scan, findScanRow(rows, scan.id), config);
}

export async function syncDeleteScan(scanId: number): Promise<void> {
  const [config, rows] = await Promise.all([getSheetConfig(), readRows()]);
  const rowIndex = findScanRow(rows, scanId);
  await sheetsApi(
    `/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    "POST",
    {
      requests: [{
        updateCells: {
          range: {
            sheetId: config.sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          rows: [{ values: [{}, {}, {}, {}, {}, {}] }],
          fields: "userEnteredValue",
        },
      }],
    },
  );
}

export async function syncCollaboratorRename(
  collaboratorId: number,
  newName: string,
): Promise<void> {
  const [config, rows] = await Promise.all([getSheetConfig(), readRows()]);
  const matchingRows: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    if (String(rows[index][1] ?? "") === String(collaboratorId)) matchingRows.push(index);
  }
  if (matchingRows.length === 0) throw new GoogleSheetsSyncError();

  const requests: Array<Record<string, unknown>> = [];
  let groupStart = matchingRows[0];
  let group: number[] = [groupStart];
  const flush = () => {
    requests.push({
      updateCells: {
        start: { sheetId: config.sheetId, rowIndex: groupStart, columnIndex: 2 },
        rows: group.map(() => ({
          values: [{ userEnteredValue: { stringValue: newName } }],
        })),
        fields: "userEnteredValue",
      },
    });
  };
  for (const rowIndex of matchingRows.slice(1)) {
    if (rowIndex === group[group.length - 1] + 1) {
      group.push(rowIndex);
      continue;
    }
    flush();
    groupStart = rowIndex;
    group = [rowIndex];
  }
  flush();

  await sheetsApi(
    `/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    "POST",
    { requests },
  );
}
