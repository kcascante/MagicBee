import os
import re

PATH = "src/lib/whatsappBot.ts"

HELPER = """
// Converts a wall-clock date+time in a given IANA timezone to a UTC ISO string.
// Does NOT depend on the server's local timezone (Vercel runs in UTC).
// Correctly handles DST. Example: 15:00 in America/Costa_Rica -> 21:00 UTC.
function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(new Date(utcGuess))) map[p.type] = p.value
  const hour = map.hour === '24' ? 0 : Number(map.hour)
  const asUTC = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    hour, Number(map.minute), Number(map.second)
  )
  const diff = asUTC - utcGuess
  return new Date(utcGuess - diff).toISOString()
}
"""

def main():
    with open(PATH, "r", encoding="utf-8") as f:
        src = f.read()

    if "function zonedTimeToUtc" in src:
        print("zonedTimeToUtc already present, skipping helper insertion.")
    else:
        # Insert helper right after todayInTimezone function
        marker = "function todayInTimezone(timezone: string): string {"
        idx = src.find(marker)
        if idx == -1:
            print("ERROR: could not find todayInTimezone marker; aborting.")
            return
        # Find the closing brace of todayInTimezone
        brace_depth = 0
        i = src.find("{", idx)
        end = -1
        while i < len(src):
            if src[i] == "{":
                brace_depth += 1
            elif src[i] == "}":
                brace_depth -= 1
                if brace_depth == 0:
                    end = i + 1
                    break
            i += 1
        if end == -1:
            print("ERROR: could not find end of todayInTimezone; aborting.")
            return
        src = src[:end] + "\n" + HELPER + src[end:]
        print("Inserted zonedTimeToUtc helper.")

    old_line = "const startISO = new Date(`${input.date}T${input.time}:00`).toISOString()"
    new_line = "const startISO = zonedTimeToUtc(input.date, input.time, ctx.org.timezone || 'America/Costa_Rica')"
    if old_line in src:
        src = src.replace(old_line, new_line)
        print("Replaced buggy startISO line.")
    else:
        print("WARN: buggy startISO line not found - may have been patched already.")

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(src)
    print("Done. Now run: git add -A && git commit -m \"fix: robust timezone conversion for whatsapp booking\" && git push")

if __name__ == "__main__":
    main()
