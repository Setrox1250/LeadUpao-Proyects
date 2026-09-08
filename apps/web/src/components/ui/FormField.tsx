const FIELD_CLASS = 'w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lead-blue focus:border-transparent'

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode
  hint?: string
}

export function FormInput({ label, hint, className = '', ...props }: FormInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input {...props} className={`${FIELD_CLASS} ${className}`} />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: React.ReactNode
}

export function FormSelect({ label, className = '', children, ...props }: FormSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select {...props} className={`${FIELD_CLASS} bg-white ${className}`}>
        {children}
      </select>
    </div>
  )
}

type FormTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: React.ReactNode
}

export function FormTextarea({ label, className = '', ...props }: FormTextareaProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea {...props} className={`${FIELD_CLASS} resize-none ${className}`} />
    </div>
  )
}

type FormActionsProps = {
  onCancel:      () => void
  loading?:      boolean
  submitLabel:   string
  loadingLabel?: string
  cancelLabel?:  string
}

export function FormActions({ onCancel, loading = false, submitLabel, loadingLabel, cancelLabel = 'Cancelar' }: FormActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={loading}
        className="flex-1 bg-lead-navy hover:bg-lead-blue disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
      >
        {loading ? (loadingLabel ?? 'Guardando...') : submitLabel}
      </button>
    </div>
  )
}

type SuccessScreenProps = {
  children:   React.ReactNode
  onClose:    () => void
  closeLabel?: string
}

export function SuccessScreen({ children, onClose, closeLabel = 'Listo' }: SuccessScreenProps) {
  return (
    <div className="space-y-4 text-center">
      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto border border-green-200">
        <span className="text-2xl text-green-500">✓</span>
      </div>
      {children}
      <button
        type="button"
        onClick={onClose}
        className="w-full bg-lead-navy hover:bg-lead-blue text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
      >
        {closeLabel}
      </button>
    </div>
  )
}
