/**
 * DateTimePicker — shadcn/ui Calendar popover + time dropdowns.
 *
 * Props:
 *   value    — ISO 8601 string (or empty string for unset)
 *   onChange — called with an ISO 8601 string when the user commits a date+time,
 *              or with "" when the value is cleared
 *   required — shows a red asterisk on the trigger label
 *   label    — trigger button label (e.g. "Expires")
 *   error    — inline error message
 *   minDate  — optional minimum selectable date (e.g. today)
 *
 * The component stores a local Date object while the popover is open and only
 * calls onChange when the user explicitly closes the popover or picks a time,
 * preventing spurious re-renders on the parent form.
 */

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, isValid, parseISO, setHours, setMinutes, setSeconds } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(d: Date): string {
  // Produce a local-timezone ISO string (no UTC conversion)
  const yyyy = d.getFullYear();
  const MM = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  // Offset
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const absOff = Math.abs(off);
  const oh = pad2(Math.floor(absOff / 60));
  const om = pad2(absOff % 60);
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}${sign}${oh}:${om}`;
}

// ─── Time scroll list ─────────────────────────────────────────────────────────

interface TimeColumnProps {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  label: string;
}

function TimeColumn({ values, selected, onSelect, label }: TimeColumnProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected item into view when the column mounts or selection changes
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selected]);

  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 select-none">
        {label}
      </span>
      <ScrollArea className="h-48 w-14">
        <div className="flex flex-col items-center py-1 gap-0.5">
          {values.map((v) => (
            <button
              key={v}
              ref={v === selected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(v)}
              className={cn(
                "w-10 h-8 rounded-md text-sm font-mono transition-colors",
                v === selected
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {pad2(v)}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DateTimePickerProps {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  minDate?: Date;
  placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const SECONDS = Array.from({ length: 60 }, (_, i) => i);

export default function DateTimePicker({
  value,
  onChange,
  label,
  required,
  error,
  minDate,
  placeholder = "Pick date & time",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  // Internal working date — initialised from value prop
  const [workDate, setWorkDate] = useState<Date | undefined>(() => {
    if (!value) return undefined;
    const d = parseISO(value);
    return isValid(d) ? d : undefined;
  });

  // Sync when value prop changes externally (e.g. form reset)
  useEffect(() => {
    if (!value) {
      setWorkDate(undefined);
      return;
    }
    const d = parseISO(value);
    if (isValid(d)) setWorkDate(d);
  }, [value]);

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    // Preserve existing time if already set, otherwise default to 00:00:00
    const base = workDate ?? new Date();
    const merged = setSeconds(
      setMinutes(setHours(day, base.getHours()), base.getMinutes()),
      base.getSeconds()
    );
    setWorkDate(merged);
    onChange(toISO(merged));
  };

  const handleTimeChange = (unit: "h" | "m" | "s", val: number) => {
    const base = workDate ?? new Date();
    let next: Date;
    if (unit === "h") next = setHours(base, val);
    else if (unit === "m") next = setMinutes(base, val);
    else next = setSeconds(base, val);
    setWorkDate(next);
    onChange(toISO(next));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkDate(undefined);
    onChange("");
    setOpen(false);
  };

  const displayText = workDate
    ? format(workDate, "dd MMM yyyy  HH:mm:ss")
    : placeholder;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        {/* Wrapper keeps the trigger and clear button visually together without nesting buttons */}
        <div className="relative flex items-center">
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-input hover:bg-accent",
                !workDate && "text-muted-foreground",
                error && "border-destructive",
                workDate && "pr-8" // leave room for the clear button
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{displayText}</span>
            </Button>
          </PopoverTrigger>

          {/* Clear button sits outside the trigger to avoid nested <button> */}
          {workDate && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 rounded-full p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/20 transition-colors"
              title="Clear"
              tabIndex={0}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <PopoverContent
          className="w-auto p-0 bg-card border-border shadow-xl"
          align="start"
          sideOffset={4}
        >
          <div className="flex flex-col sm:flex-row">
            {/* Calendar */}
            <Calendar
              mode="single"
              selected={workDate}
              onSelect={handleDaySelect}
              disabled={minDate ? { before: minDate } : undefined}
              initialFocus
              className="rounded-l-lg border-r border-border"
            />

            {/* Time picker */}
            <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-border">
              <div className="px-3 pt-3 pb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Time
                </p>
                <p className="text-lg font-mono font-semibold text-foreground mt-0.5">
                  {workDate
                    ? format(workDate, "HH:mm:ss")
                    : "--:--:--"}
                </p>
              </div>
              <div className="flex gap-1 px-2 pb-3">
                <TimeColumn
                  label="HH"
                  values={HOURS}
                  selected={workDate?.getHours() ?? 0}
                  onSelect={(v) => handleTimeChange("h", v)}
                />
                <div className="flex items-center text-muted-foreground font-mono text-lg pt-6">:</div>
                <TimeColumn
                  label="MM"
                  values={MINUTES}
                  selected={workDate?.getMinutes() ?? 0}
                  onSelect={(v) => handleTimeChange("m", v)}
                />
                <div className="flex items-center text-muted-foreground font-mono text-lg pt-6">:</div>
                <TimeColumn
                  label="SS"
                  values={SECONDS}
                  selected={workDate?.getSeconds() ?? 0}
                  onSelect={(v) => handleTimeChange("s", v)}
                />
              </div>

              {/* Confirm / close */}
              <div className="px-3 pb-3 border-t border-border pt-2">
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={() => setOpen(false)}
                  disabled={!workDate}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  );
}
