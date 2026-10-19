export function accountingLabel(status?:string) {
  switch(status) {
    case "final_synced": return "Included in final QuickBooks total";
    case "final_prepared": case "final_processing": return "Included in saved final total";
    case "final_review": return "Final total needs accounting review";
    case "synced": return "Recorded in QuickBooks";
    case "pending": return "Held for final sales total";
    case "processing": return "Recording in QuickBooks";
    case "review": return "Needs accounting review";
    case "failed": return "Could not record in QuickBooks";
    default: return "Not queued for QuickBooks";
  }
}
