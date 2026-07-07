"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  adminStudentSchema,
  AdminStudentSchema,
  formatPhoneNumber,
  GUARDIAN_RELATIONSHIPS,
} from "@/lib/validation/student";
import {
  GRADE_OPTIONS,
  GENDER_OPTIONS,
  TSHIRT_SIZE_OPTIONS,
  DUES,
} from "@/lib/belles-beaux/config";
import { MembershipType } from "@/types/student";

const inputClass =
  "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-colors text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
const errorClass = "mt-1 text-xs text-red-600";

export const emptyGuardian = {
  relationship: "" as (typeof GUARDIAN_RELATIONSHIPS)[number],
  name: "",
  mailingAddress: "",
  city: "",
  state: "",
  zipCode: "",
  cellNumber: "",
  email: "",
  formalName: "",
};

interface StudentFormProps {
  defaultValues?: AdminStudentSchema;
  submitLabel: string;
  busy?: boolean;
  onValidSubmit: (data: AdminStudentSchema, duesAmount: number | null) => void;
}

/**
 * Shared admin student form — used by both the manual-add and edit pages.
 * Validates against adminStudentSchema (no media release / reCAPTCHA).
 */
export default function StudentForm({
  defaultValues,
  submitLabel,
  busy = false,
  onValidSubmit,
}: StudentFormProps) {
  // Live pricing from settings table (falls back to config defaults)
  const [liveDues, setLiveDues] = useState<typeof DUES>(DUES);
  useEffect(() => {
    fetch("/api/belles-beaux/pricing")
      .then((res) => res.json())
      .then((data) => data.dues && setLiveDues(data.dues))
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdminStudentSchema>({
    resolver: zodResolver(adminStudentSchema),
    defaultValues: defaultValues ?? {
      firstName: "",
      middleName: "",
      lastName: "",
      nickname: "",
      cellNumber: "",
      school: "",
      grade: undefined,
      gender: "",
      tshirtSize: "",
      guardians: [emptyGuardian],
      membershipType: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "guardians" });

  const grade = watch("grade");
  const membershipType = watch("membershipType");

  // Grade 9 is always freshman; otherwise clear a membership type that no
  // longer fits the selected grade (e.g. grade edited from 11 to 10)
  useEffect(() => {
    if (grade === "9") {
      if (membershipType !== "freshman") setValue("membershipType", "freshman");
      return;
    }
    const gradeLabel: Record<string, string> = { "10": "sophomore", "11": "junior", "12": "senior" };
    if (!grade || !gradeLabel[grade]) return;
    const allowed = ["returning", `new_${gradeLabel[grade]}`];
    if (membershipType && !allowed.includes(membershipType)) {
      setValue("membershipType", undefined as unknown as MembershipType);
    }
  }, [grade, membershipType, setValue]);

  const membershipOptions = (() => {
    if (!grade || grade === "9") return null;
    const gradeLabel: Record<string, string> = { "10": "Sophomore", "11": "Junior", "12": "Senior" };
    const newType = `new_${gradeLabel[grade].toLowerCase()}` as MembershipType;
    return [
      { value: "returning", label: `Returning Member — $${liveDues.returning.toLocaleString()}` },
      { value: newType,     label: `First-Time ${gradeLabel[grade]} (New Member) — $${liveDues[newType].toLocaleString()}` },
    ];
  })();

  const phoneField = (name: `cellNumber` | `guardians.${number}.cellNumber`) => ({
    ...register(name),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(name, formatPhoneNumber(e.target.value), { shouldValidate: false });
    },
  });

  const onSubmit = (data: AdminStudentSchema) =>
    onValidSubmit(data, data.membershipType ? liveDues[data.membershipType] : null);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Student */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-6">Student</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>First Name *</label>
            <input type="text" {...register("firstName")} className={inputClass} />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input type="text" {...register("lastName")} className={inputClass} />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Middle Name</label>
            <input type="text" {...register("middleName")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nickname</label>
            <input type="text" {...register("nickname")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Student Cell *</label>
            <input type="tel" placeholder="(432) 555-1234" {...phoneField("cellNumber")} className={inputClass} />
            {errors.cellNumber && <p className={errorClass}>{errors.cellNumber.message}</p>}
          </div>
          <div>
            <label className={labelClass}>School *</label>
            <input type="text" {...register("school")} className={inputClass} />
            {errors.school && <p className={errorClass}>{errors.school.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Grade *</label>
            <select {...register("grade")} className={inputClass}>
              <option value="">Select grade...</option>
              {GRADE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.grade && <p className={errorClass}>{errors.grade.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Gender *</label>
            <select {...register("gender")} className={inputClass}>
              <option value="">Select...</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.gender && <p className={errorClass}>{errors.gender.message}</p>}
          </div>
          <div>
            <label className={labelClass}>T-Shirt Size *</label>
            <select {...register("tshirtSize")} className={inputClass}>
              <option value="">Select size...</option>
              {TSHIRT_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.tshirtSize && <p className={errorClass}>{errors.tshirtSize.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Membership *</label>
            {grade === "9" ? (
              <p className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 text-sm">
                New Freshman — ${liveDues.freshman.toLocaleString()}
              </p>
            ) : membershipOptions ? (
              <select {...register("membershipType")} className={inputClass}>
                <option value="">Select membership...</option>
                {membershipOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <p className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-400 text-sm">
                Select a grade first
              </p>
            )}
            {errors.membershipType && <p className={errorClass}>{errors.membershipType.message}</p>}
          </div>
        </div>
      </div>

      {/* Guardians */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6">
        <h2 className="text-lg font-semibold text-[#1a1a2e] mb-1">Guardians</h2>
        <p className="text-sm text-gray-400 mb-6">
          At least one guardian is required. A guardian email is needed to send an invoice.
        </p>
        {fields.map((field, index) => {
          const gErrors = errors.guardians?.[index];
          return (
            <div key={field.id} className={index > 0 ? "mt-6 pt-6 border-t border-gray-100" : ""}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-500">Guardian {index + 1}</p>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Relationship *</label>
                  <select {...register(`guardians.${index}.relationship`)} className={inputClass}>
                    <option value="">Select...</option>
                    {GUARDIAN_RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {gErrors?.relationship && <p className={errorClass}>{gErrors.relationship.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Name</label>
                  <input type="text" {...register(`guardians.${index}.name`)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" {...register(`guardians.${index}.email`)} className={inputClass} />
                  {gErrors?.email && <p className={errorClass}>{gErrors.email.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Cell</label>
                  <input type="tel" placeholder="(432) 555-1234" {...phoneField(`guardians.${index}.cellNumber`)} className={inputClass} />
                  {gErrors?.cellNumber && <p className={errorClass}>{gErrors.cellNumber.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Mailing Address</label>
                  <input type="text" {...register(`guardians.${index}.mailingAddress`)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <input type="text" {...register(`guardians.${index}.city`)} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>State</label>
                    <input type="text" maxLength={2} placeholder="TX" {...register(`guardians.${index}.state`)} className={inputClass} />
                    {gErrors?.state && <p className={errorClass}>{gErrors.state.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>ZIP</label>
                    <input type="text" {...register(`guardians.${index}.zipCode`)} className={inputClass} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {fields.length < 4 && (
          <button
            type="button"
            onClick={() => append(emptyGuardian)}
            className="mt-6 text-sm font-semibold text-[#d4af37] hover:text-[#c19b2e] transition-colors"
          >
            + Add Another Guardian
          </button>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="bg-[#d4af37] text-[#1a1a2e] px-10 py-3 rounded-lg font-semibold hover:bg-[#c19b2e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
