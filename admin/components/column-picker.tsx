"use client";

import type { Table } from "@tanstack/react-table";
import { Columns3 } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export type PickerColumn = { id: string; label: string; visible: boolean };

/** A TanStack table's columns for the picker, named by `labels`. */
export function tableColumns<Row>(
  table: Table<Row>,
  labels: Record<string, string>,
): PickerColumn[] {
  return table.getAllColumns().map((col) => ({
    id: col.id,
    label: labels[col.id] ?? col.id,
    visible: col.getIsVisible(),
  }));
}

/** The "Columns" menu above a table: show or hide each column, or go back to the defaults. */
export function ColumnPicker({
  columns,
  onToggle,
  isDefault,
  onReset,
}: {
  columns: PickerColumn[];
  onToggle: (id: string, visible: boolean) => void;
  isDefault: boolean;
  onReset: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Columns3 className="mr-1.5 h-4 w-4" />
            Columns
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={col.visible}
              onCheckedChange={(visible) => onToggle(col.id, visible)}
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isDefault} onClick={onReset}>
          Reset to defaults
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
