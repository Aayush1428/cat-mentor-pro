import React from 'react'

export default function Layout({ sidebar, topbar, children }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      {sidebar}
      {topbar}
      <main className="pt-14 transition-all duration-300" style={{ marginLeft: 'var(--sidebar-width, 210px)' }}>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
