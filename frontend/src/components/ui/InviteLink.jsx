"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { copyText } from "@/utils/format";
import Alert from "./Alert";

export default function InviteLink({ link }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    try {
      await copyText(link);
      setCopied(true);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="invite-block">
      <label htmlFor="invite-link">Invite link</label>
      <div className="invite-input">
        <input
          id="invite-link"
          value={link}
          readOnly
          onFocus={(e) => e.target.select()}
        />
        <button
          className="icon-button"
          onClick={copy}
          aria-label={copied ? "Invite copied" : "Copy invite link"}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
      </div>
      {copied && (
        <p className="small muted" role="status">
          Invite link copied.
        </p>
      )}
      <Alert>{error}</Alert>
    </div>
  );
}
