"use client";

import { useEffect, useState } from "react";
import type { MeetFeeSchedule, MeetSwimmer } from "@/lib/meets/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const emptyMeetFeeSchedule = (): MeetFeeSchedule => ({
  mode: "per_event", flatFee: 0, eventPrices: [], charges: [],
});

function numbers(text: string): number[] {
  return text.split(",").map(s => s.trim()).filter(Boolean).map(Number);
}

function EventNumbersInput({ value, onChange, label, placeholder }: { value: number[]; onChange: (value: number[]) => void; label: string; placeholder: string }) {
  const [text, setText] = useState(value.join(","));
  const serialized = value.join(",");
  useEffect(() => setText(serialized), [serialized]);
  return <Input aria-label={label} placeholder={placeholder} value={text} onChange={e => setText(e.target.value)} onBlur={() => onChange(numbers(text))} />;
}

export function MeetFeeScheduleEditor({ value, onChange, swimmers }: {
  value: MeetFeeSchedule; onChange: (value: MeetFeeSchedule) => void; swimmers: MeetSwimmer[];
}) {
  return <div className="space-y-4 rounded-lg border p-4">
    <h3 className="font-semibold">Host pricing rules</h3>
    <label className="block">Pricing
      <select className="ml-2 rounded border p-2" value={value.mode} onChange={e => onChange({ ...value, mode: e.target.value as MeetFeeSchedule["mode"] })}>
        <option value="per_event">Surcharge + selected event prices</option>
        <option value="flat">Surcharge + flat swimmer fee (events included)</option>
      </select>
    </label>
    {value.mode === "flat" && <label className="block">Flat fee per swimmer
      <Input aria-label="Flat fee per swimmer" type="number" min="0" step="0.01" value={value.flatFee} onChange={e => onChange({ ...value, flatFee: Number(e.target.value) })} />
    </label>}
    <p className="text-xs text-slate-600">Price overrides take priority over Event File prices and the default individual event fee. Add a separate group for timed finals, prelims/finals, distance, or relay events. Use 0 for free events. Flat pricing includes all events.</p>
    {value.eventPrices.map((row, i) => <div key={i} className="grid gap-2 sm:grid-cols-4">
      <Input aria-label={`Price group ${i + 1} label`} placeholder="Prelims / finals" value={row.label} onChange={e => onChange({ ...value, eventPrices: value.eventPrices.map((r, j) => j === i ? { ...r, label: e.target.value } : r) })} />
      <EventNumbersInput label={`Price group ${i + 1} event numbers`} placeholder="Event numbers: 2,3,4" value={row.eventNumbers} onChange={ns => onChange({ ...value, eventPrices: value.eventPrices.map((r, j) => j === i ? { ...r, eventNumbers: ns } : r) })} />
      <Input aria-label={`Price group ${i + 1} amount`} type="number" min="0" step="0.01" value={row.amount} onChange={e => onChange({ ...value, eventPrices: value.eventPrices.map((r, j) => j === i ? { ...r, amount: Number(e.target.value) } : r) })} />
      <Button variant="outline" onClick={() => onChange({ ...value, eventPrices: value.eventPrices.filter((_, j) => j !== i) })}>Remove price group</Button>
    </div>)}
    <Button variant="outline" onClick={() => onChange({ ...value, eventPrices: [...value.eventPrices, { label: "", eventNumbers: [], amount: 0 }] })}>Add event price group</Button>
    <p className="text-xs text-slate-600">Additional charges or credits: once per swimmer, per selected day/session, or a percentage of the base fee. A negative amount applies a credit. Optional event numbers limit a charge to swimmers selecting those events. Daily fees require dated sessions. Select individual swimmers for host-confirmed allocations or waivers. Team and relay charges must be allocated explicitly; do not charge the full team amount to every swimmer.</p>
    {value.charges.map((row, i) => <div key={i} className="grid gap-2 sm:grid-cols-5">
      <Input aria-label={`Charge ${i + 1} label`} placeholder="Facility / late fee / credit" value={row.label} onChange={e => onChange({ ...value, charges: value.charges.map((r, j) => j === i ? { ...r, label: e.target.value } : r) })} />
      <Input aria-label={`Charge ${i + 1} amount`} type="number" step="0.01" value={row.amount} onChange={e => onChange({ ...value, charges: value.charges.map((r, j) => j === i ? { ...r, amount: Number(e.target.value) } : r) })} />
      <select aria-label={`Charge ${i + 1} basis`} className="rounded border p-2" value={row.unit} onChange={e => onChange({ ...value, charges: value.charges.map((r, j) => j === i ? { ...r, unit: e.target.value as typeof row.unit } : r) })}>
        <option value="swimmer">Per swimmer ($)</option><option value="day">Per selected day ($)</option><option value="session">Per selected session ($)</option><option value="percent">Base fee (%)</option>
      </select>
      <EventNumbersInput label={`Charge ${i + 1} event numbers`} placeholder="All events (or 1,2,3)" value={row.eventNumbers || []} onChange={ns => onChange({ ...value, charges: value.charges.map((r, j) => j === i ? { ...r, eventNumbers: ns } : r) })} />
      <label className="text-xs">Applies to
        <select aria-label={`Charge ${i + 1} swimmers`} className="w-full rounded border p-2" multiple value={row.swimmerIds?.length ? row.swimmerIds : ["*"]} onChange={e => {
          const ids = Array.from(e.target.selectedOptions).map(o => o.value).filter(id => id !== "*");
          onChange({ ...value, charges: value.charges.map((r, j) => j === i ? { ...r, swimmerIds: ids } : r) });
        }}>
          <option value="*">All swimmers</option>
          {swimmers.map(swimmer => <option key={swimmer.id} value={swimmer.id}>{swimmer.childFirstName} {swimmer.childLastName}</option>)}
        </select>
      </label>
      <Button variant="outline" onClick={() => onChange({ ...value, charges: value.charges.filter((_, j) => j !== i) })}>Remove charge</Button>
    </div>)}
    <Button variant="outline" onClick={() => onChange({ ...value, charges: [...value.charges, { label: "", amount: 0, unit: "swimmer" }] })}>Add charge or credit</Button>
  </div>;
}
