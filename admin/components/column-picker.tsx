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

/** The "Columns" menu above a table: show or hide each column, or go back to the defaults. */
export function ColumnPicker<Row>({
  table,
  labels,
  isDefault,
  onReset,
}: {
  table: Table<Row>;
  /** column id → name in the menu */
  labels: Record<string, string>;
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
          {table.getAllColumns().map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={col.getIsVisible()}
              onCheckedChange={(val) => col.toggleVisibility(val)}
            >
              {labels[col.id] ?? col.id}
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
