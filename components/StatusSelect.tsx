"use client";
// The task status dropdown submits its form as soon as it changes. That needs an
// event handler, which a server component cannot pass, so it lives here.
export default function StatusSelect({ name, defaultValue, options }: { name: string; defaultValue: string; options: string[] }) {
  return (
    <select name={name} defaultValue={defaultValue} onChange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Task status">
      {options.map((c) => <option key={c}>{c}</option>)}
    </select>
  );
}
