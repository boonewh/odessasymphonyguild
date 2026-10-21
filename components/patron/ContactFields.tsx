import type { PatronContact } from "@/lib/patron/model";
import styles from "./PatronForm.module.css";

export default function ContactFields({ prefix, values, emailRequired = false }: {
  prefix: string; values?: PatronContact; emailRequired?: boolean;
}) {
  return <>
    <div className={styles.field}>
      <label htmlFor={`${prefix}-name`}>Name for the thank-you section</label>
      <input id={`${prefix}-name`} name="name" type="text" autoComplete="name" required minLength={2} maxLength={120} defaultValue={values?.name || ""} aria-describedby={`${prefix}-name-help`} />
      <p id={`${prefix}-name-help`} className={styles.hint}>Enter the name exactly as it should appear publicly.</p>
    </div>
    <div className={styles.field}>
      <label htmlFor={`${prefix}-email`}>Email{!emailRequired && " (optional)"}</label>
      <input id={`${prefix}-email`} name="email" type="email" autoComplete="email" required={emailRequired} maxLength={254} defaultValue={values?.email || ""} />
    </div>
    <div className={styles.field}>
      <label htmlFor={`${prefix}-phone`}>Phone (optional)</label>
      <input id={`${prefix}-phone`} name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={values?.phone || ""} />
    </div>
  </>;
}
