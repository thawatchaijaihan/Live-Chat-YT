const THAI_TIME_FORMATTER = new Intl.DateTimeFormat("th-TH-u-nu-latn", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatThaiTime(date: string) {
  return THAI_TIME_FORMATTER.format(new Date(date));
}
