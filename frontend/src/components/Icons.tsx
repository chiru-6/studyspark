
type P = { size?: number };
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Spark = ({ size }: P) => (
  <svg {...base(size)}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
);
export const Upload = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>
);
export const FileText = ({ size }: P) => (
  <svg {...base(size)}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>
);
export const Plus = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
);
export const Trash = ({ size }: P) => (
  <svg {...base(size)}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
);
export const Download = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 4v12M6 10l6 6 6-6M4 20h16" /></svg>
);
export const Copy = ({ size }: P) => (
  <svg {...base(size)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
);
export const Shuffle = ({ size }: P) => (
  <svg {...base(size)}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
);
export const ChevronLeft = ({ size }: P) => (
  <svg {...base(size)}><path d="m15 18-6-6 6-6" /></svg>
);
export const ChevronRight = ({ size }: P) => (
  <svg {...base(size)}><path d="m9 18 6-6-6-6" /></svg>
);
export const Check = ({ size }: P) => (
  <svg {...base(size)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const X = ({ size }: P) => (
  <svg {...base(size)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const Menu = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
export const Github = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.2-1.5 6.2-6.7A5.2 5.2 0 0 0 20 5.2 4.8 4.8 0 0 0 19.9 1.6S18.7 1.3 16 3.1a13.4 13.4 0 0 0-7 0C6.3 1.3 5.1 1.6 5.1 1.6A4.8 4.8 0 0 0 5 5.2a5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.2 6.4 6.2 6.7a3.4 3.4 0 0 0-.9 2.6V22" /></svg>
);
