type ChipVariant = "green" | "amber" | "red" | "gray";

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  green: "bg-primary/10 text-primary",
  amber: "bg-chip-orange text-chip-orange-text",
  red: "bg-chip-red text-chip-red-text",
  gray: "bg-chip-gray text-chip-gray-text",
};

export default function StatusChip({
  label,
  variant = "gray",
}: {
  label: string;
  variant?: ChipVariant;
}) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
      {label}
    </span>
  );
}

export function getLeaveChipVariant(status: string): ChipVariant {
  if (status === "approved") return "green";
  if (status === "pending") return "amber";
  if (status === "cancelled") return "red";
  return "gray";
}
