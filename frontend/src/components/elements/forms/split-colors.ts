/**
 * The colours of a split bar's parts, by position in the list: the causes
 * take the first three, a cause's organizations up to six. White text on each
 * passes 4.5:1.
 */
const SPLIT_COLORS = [
  { background: "bg-primary-700", text: "text-primary-700" },
  { background: "bg-amber-700", text: "text-amber-700" },
  { background: "bg-blue-700", text: "text-blue-700" },
  { background: "bg-violet-700", text: "text-violet-700" },
  { background: "bg-rose-700", text: "text-rose-700" },
  { background: "bg-cyan-700", text: "text-cyan-700" },
];

export function splitColor(index: number) {
  return SPLIT_COLORS[index % SPLIT_COLORS.length];
}
