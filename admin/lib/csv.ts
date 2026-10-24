/**
 * CSV files for spreadsheets: quoted where needed (RFC 4180), with a byte
 * order mark so Excel reads the file as UTF-8, and with text that a
 * spreadsheet would run as a formula made inert.
 */

export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => CsvValue;
}

// A spreadsheet runs text starting with one of these as a formula. Donors
// type names, company names and notes themselves, so text never may.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const lines = [
    columns.map((column) => cell(column.header)),
    ...rows.map((row) => columns.map((column) => cell(column.value(row)))),
  ];
  return `﻿${lines.map((line) => line.join(",")).join("\r\n")}\r\n`;
}

/** Cents as a number of euros, e.g. 12345 → 123.45. */
export function euros(cents: number | null | undefined): number | null {
  return typeof cents === "number" ? cents / 100 : null;
}

const tallinn = (options: Intl.DateTimeFormatOptions) =>
  // Swedish formats dates the ISO way, which spreadsheets read as dates
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Tallinn", ...options });

const tallinnDay = tallinn({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const tallinnMinute = tallinn({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** A moment as its day in Estonia, e.g. "2026-10-24". */
export function day(iso: string | null | undefined): string | null {
  return iso ? tallinnDay.format(new Date(iso)) : null;
}

/** A moment as Estonian time to the minute, e.g. "2026-10-24 15:05". */
export function minute(iso: string | null | undefined): string | null {
  return iso ? tallinnMinute.format(new Date(iso)) : null;
}
