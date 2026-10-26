import { useState } from "react";
import { Eye, EyeOff, Check, Circle } from "lucide-react";
import { RULES } from "../auth/authHelpers";

export function PasswordField({ label, value, onChange, autoComplete, autoFocus, id }) {
  const [show, setShow] = useState(false);
  return (
    <label htmlFor={id}>{label}
      <span className="pw-wrap">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} />
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

export function Checklist({ password }) {
  return (
    <ul className="checklist" aria-label="Password requirements">
      {RULES.map(([label, ok]) => {
        const good = ok(password);
        return <li key={label} className={good ? "ok" : ""}>{good ? <Check size={14} /> : <Circle size={10} />} {label}</li>;
      })}
    </ul>
  );
}