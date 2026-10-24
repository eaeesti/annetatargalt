import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // Type parameters must match the library's declaration to merge with it.
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Classes for the column's header and body cells, e.g. alignment or width. */
    className?: string;
  }
}
