export default function ToyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <circle cx="6.5" cy="5" r="2.5" />
      <circle cx="17.5" cy="5" r="2.5" />
      <circle cx="12" cy="8.5" r="5" />
      <ellipse cx="12" cy="17.5" rx="6" ry="5.5" />
      <circle cx="5" cy="14" r="2.2" />
      <circle cx="19" cy="14" r="2.2" />
      <circle cx="7.5" cy="21" r="2.3" />
      <circle cx="16.5" cy="21" r="2.3" />
    </svg>
  );
}
