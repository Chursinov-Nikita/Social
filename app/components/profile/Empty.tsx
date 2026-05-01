export function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-(--border) p-8 text-center text-sm text-(--text-primary)/20">
      {label}
    </div>
  );
}
