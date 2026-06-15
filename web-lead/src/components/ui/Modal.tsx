'use client'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  onClose:      () => void
  title:        string
  description?: string
  size?:        Size
  children:     React.ReactNode
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export default function Modal({ onClose, title, description, size = 'sm', children }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-2xl shadow-2xl w-full ${SIZE_CLASS[size]} p-6`}
      >
        <div className={`flex items-start justify-between gap-4 ${description ? 'mb-1' : 'mb-6'}`}>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}

        {children}
      </div>
    </div>
  )
}
