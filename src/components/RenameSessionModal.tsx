import React, { useEffect, useRef, useState } from "react";
import { normalizeSessionLabel } from "../lib/session-label-overrides.ts";

type RenameSessionModalProps = {
  open: boolean;
  initialLabel: string;
  onClose: () => void;
  onRename: (label: string) => void;
};

export default function RenameSessionModal(props: RenameSessionModalProps) {
  const [label, setLabel] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedLabel = normalizeSessionLabel(label);

  useEffect(() => {
    if (!props.open) {
      setLabel("");
      return;
    }
    setLabel(props.initialLabel);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [props.initialLabel, props.open]);

  if (!props.open) {
    return null;
  }

  const submit = () => {
    if (!normalizedLabel) {
      return;
    }
    props.onRename(normalizedLabel);
  };

  return (
    <div className="modal-backdrop compact">
      <div className="new-session-modal rename-session-modal">
        <div className="modal-title">Rename session</div>
        <p className="modal-subtitle">
          Choose the ClawFace display name for this OpenClaw session.
        </p>

        <input
          ref={inputRef}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              props.onClose();
            }
          }}
          className="ui-input"
          placeholder="Session name"
          aria-label="Session name"
        />

        <div className="new-session-actions">
          <button type="button" onClick={props.onClose} className="ui-btn ui-btn-light">
            Cancel
          </button>
          <button type="button" onClick={submit} className="ui-btn ui-btn-primary" disabled={!normalizedLabel}>
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
