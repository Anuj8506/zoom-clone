import {
  Video,
  Plus,
  CalendarDays,
  ArrowUpFromLine,
  ChevronDown,
} from "lucide-react";

export default function ActionTiles({
  onNew,
  onJoin,
  onSchedule,
  onShare,
  busy,
}) {
  const actions = [
    {
      label: "New Meeting",
      description: "Start a conversation",
      icon: Video,
      onClick: onNew,
      orange: true,
    },
    {
      label: "Join",
      description: "Meet with an invite",
      icon: Plus,
      onClick: onJoin,
    },
    {
      label: "Schedule",
      description: "Plan a little ahead",
      icon: CalendarDays,
      onClick: onSchedule,
    },
    {
      label: "Share Screen",
      description: "Bring your ideas along",
      icon: ArrowUpFromLine,
      onClick: onShare,
    },
  ];
  return (
    <div className="action-tiles">
      {actions.map(({ label, description, icon: Icon, onClick, orange }) => (
        <button
          key={label}
          className="action-tile"
          onClick={onClick}
          disabled={busy}
          aria-label={label}
        >
          <span className={`tile-icon ${orange ? "orange" : ""}`}>
            <Icon
              size={37}
              strokeWidth={1.9}
              fill={orange ? "currentColor" : "none"}
            />
          </span>
          <strong>
            {orange && busy ? "Starting…" : label}
            {orange && <ChevronDown size={13} />}
          </strong>
          <span className="tile-description">{description}</span>
        </button>
      ))}
    </div>
  );
}
