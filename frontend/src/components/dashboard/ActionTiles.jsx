import { Video, Plus, CalendarDays } from "lucide-react";

export default function ActionTiles({ onNew, onJoin, onSchedule, busy }) {
  const actions = [
    { label: "Schedule", icon: CalendarDays, onClick: onSchedule },
    { label: "Join", icon: Plus, onClick: onJoin },
    { label: "New Meeting", icon: Video, onClick: onNew, orange: true },
  ];
  return (
    <div className="action-tiles">
      {actions.map(({ label, icon: Icon, onClick, orange }) => (
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
          <strong>{orange && busy ? "Starting…" : label}</strong>
        </button>
      ))}
    </div>
  );
}
