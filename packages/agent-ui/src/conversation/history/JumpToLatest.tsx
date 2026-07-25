export function JumpToLatest({
  label,
  onClick,
  visible,
}: {
  label: string;
  onClick: () => void;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
      <button
        className="pointer-events-auto flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs shadow-sm"
        onClick={onClick}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}
