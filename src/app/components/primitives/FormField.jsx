// src/app/components/primitives/FormField.jsx
export default function FormField({
  label,
  htmlFor,
  children,
  help,
  reserveHelp = false,
  style,
}) {
  return (
    <div className="form-field" style={style}>
      {label && (
        <label htmlFor={htmlFor} className="form-label">
          {label}
        </label>
      )}
      {children}
      {(reserveHelp || help) && (
        <small className="form-help">{help || ""}</small>
      )}
    </div>
  );
}
