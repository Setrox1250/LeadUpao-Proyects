'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import ChangePasswordModal from './ChangePasswordModal'

type Props = {
  userName: string
  userRole: string
  isAdmin:  boolean
  isFounder: boolean
  signOutAction: () => Promise<void>
}

type MenuItem = {
  id:    string
  label: string
  href:  string
  icon:  React.ReactNode
  adminOnly?:   boolean
  founderOnly?: boolean
}

export default function Sidebar({ userName, userRole, isAdmin, isFounder, signOutAction }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'dashboard'

  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Inicio',
      href: '/admin?tab=dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: 'tareas',
      label: 'Tablero de Tareas',
      href: '/admin?tab=tareas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    {
      id: 'miembros',
      label: 'Gestión de Miembros',
      href: '/admin?tab=miembros',
      adminOnly: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      id: 'auditoria',
      label: 'Auditoría',
      href: '/admin?tab=auditoria',
      adminOnly: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'configuracion',
      label: 'Configuración',
      href: '/admin?tab=configuracion',
      founderOnly: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ]

  const filteredItems = menuItems.filter(item => (!item.adminOnly || isAdmin) && (!item.founderOnly || isFounder))

  const NavLinks = () => (
    <nav className="space-y-1.5 px-3 flex-1">
      {filteredItems.map(item => {
        const isActive = activeTab === item.id
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => setIsOpen(false)}
            className={`flex items-center rounded-xl text-sm font-semibold transition-all duration-200 group relative ${
              isCollapsed ? 'lg:justify-center lg:px-0 lg:h-12' : 'px-4 py-3'
            } ${
              isActive
                ? 'bg-lead-gold text-lead-navy shadow-md shadow-lead-gold/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={`transition-transform duration-200 group-hover:scale-110 flex-shrink-0 ${isActive ? 'text-lead-navy' : 'text-gray-400 group-hover:text-lead-gold'}`}>
              {item.icon}
            </span>
            <span className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
              isCollapsed ? 'lg:w-0 lg:opacity-0 lg:ml-0' : 'w-auto opacity-100 ml-3.5'
            }`}>
              {item.label}
            </span>

            {/* Hover Tooltip (Only when collapsed on desktop) */}
            {isCollapsed && (
              <div className="hidden lg:block absolute left-16 top-1/2 -translate-y-1/2 bg-[#091328] text-white text-xs font-bold px-3 py-2 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-xl z-50 whitespace-nowrap ml-2">
                {item.label}
                {/* Tooltip pointer arrow */}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-[#091328]" />
              </div>
            )}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* ── HEADER MÓVIL (SÓLO PANTALLAS PEQUEÑAS) ────────────────── */}
      <div className="lg:hidden bg-lead-navy text-white h-16 px-6 flex items-center justify-between border-b border-white/10 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-lead-gold rounded flex items-center justify-center">
            <span className="text-lead-navy font-black text-xs">L</span>
          </div>
          <span className="font-bold tracking-wide text-sm">LEAD UPAO</span>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Abrir menú de navegación"
          className="p-2 -mr-2 text-gray-400 hover:text-white focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* ── DRAWER MÓVIL (OVERLAY EN MÓVIL) ────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── CONTENEDOR PRINCIPAL DEL SIDEBAR ─────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 md:w-72 bg-gradient-to-b from-[#0f2044] via-[#0a152e] to-[#040914] border-r border-white/5 z-50 lg:z-30 flex flex-col justify-between transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:h-screen lg:flex-shrink-0 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } relative`}
      >
        {/* Floating toggle button for desktop */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expandir menú' : 'Minimizar menú'}
          className="hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-lead-gold hover:bg-lead-crimson text-white items-center justify-center shadow-lg border border-white/10 z-50 cursor-pointer transition-transform duration-200 hover:scale-110"
          title={isCollapsed ? 'Expandir menú' : 'Minimizar menú'}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Header / Logo */}
        <div>
          <div className="h-16 flex items-center px-5 border-b border-white/5 overflow-hidden">
            <div className="flex items-center w-full">
              <div className="w-8 h-8 bg-lead-gold rounded-lg flex items-center justify-center shadow-lg shadow-lead-gold/20 flex-shrink-0">
                <span className="text-lead-navy font-black text-base">L</span>
              </div>
              <div className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
                isCollapsed ? 'lg:w-0 lg:opacity-0 lg:ml-0' : 'w-auto opacity-100 ml-3'
              }`}>
                <span className="font-black tracking-wide text-white block leading-none">LEAD UPAO</span>
                <span className="text-[10px] text-blue-300 font-bold tracking-widest uppercase">Admin Panel</span>
              </div>
            </div>
            {/* Botón cerrar en móvil */}
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar menú de navegación"
              className="lg:hidden p-1 text-gray-400 hover:text-white transition-colors ml-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="h-6" />

          {/* Enlaces de Navegación */}
          <NavLinks />
        </div>

        {/* Footer / Tarjeta de Perfil & Logout */}
        <div className={`border-t border-white/5 bg-[#070f21]/40 transition-all duration-300 ${
          isCollapsed ? 'lg:p-2' : 'p-4'
        }`}>
          <div className={`flex items-center rounded-xl bg-white/5 border border-white/5 transition-all duration-300 ${
            isCollapsed ? 'lg:justify-center lg:p-2 lg:mb-3' : 'px-2 py-3 mb-3'
          }`}>
            <div className="w-10 h-10 rounded-full bg-lead-gold text-lead-navy font-bold flex items-center justify-center flex-shrink-0 shadow-inner">
              {initials}
            </div>
            <div className={`min-w-0 transition-all duration-300 ease-in-out overflow-hidden ${
              isCollapsed ? 'lg:w-0 lg:opacity-0 lg:ml-0' : 'flex-1 ml-3'
            }`}>
              <p className="text-xs font-bold text-white truncate leading-tight">{userName}</p>
              <p className="text-[10px] text-blue-300 font-medium truncate mt-0.5 leading-none">{userRole}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className={`w-full flex items-center justify-center gap-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/5 border border-white/5 hover:bg-white/10 transition-all duration-200 mb-2 ${
              isCollapsed ? 'lg:h-10 lg:w-10 lg:p-0' : 'py-2.5 px-4'
            }`}
            title={isCollapsed ? 'Cambiar contraseña' : undefined}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 11-12 0 6 6 0 0112 0zM7 9l-4 4m0 0l2 2m-2-2l2-2" />
            </svg>
            <span className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
              isCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
            }`}>
              Cambiar contraseña
            </span>
          </button>

          <form action={signOutAction}>
            <button
              type="submit"
              className={`w-full flex items-center justify-center gap-2 rounded-xl text-xs font-semibold text-red-200/80 hover:text-white bg-red-950/20 border border-red-500/10 hover:bg-red-600 transition-all duration-200 ${
                isCollapsed ? 'lg:h-10 lg:w-10 lg:p-0' : 'py-2.5 px-4'
              }`}
              title={isCollapsed ? 'Cerrar sesión' : undefined}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${
                isCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
              }`}>
                Cerrar sesión
              </span>
            </button>
          </form>
        </div>
      </aside>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </>
  )
}
