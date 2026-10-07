import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Alert({ children, success = false }) {
  if (!children) return null;
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`alert ${success ? "success" : ""}`}
      role={success ? "status" : "alert"}
    >
      <Icon size={18} />
      <span>{children}</span>
    </div>
  );
}
