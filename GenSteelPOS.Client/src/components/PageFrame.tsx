import type { PropsWithChildren, ReactNode } from 'react'

interface PageFrameProps extends PropsWithChildren {
  title: string
  description?: string
  aside?: ReactNode
}

export function PageFrame({ title, description, aside, children }: PageFrameProps) {
  return (
    <section className="page-frame">
      <div className="page-hero">
        <div className="page-hero-copy">
          <h3>{title}</h3>
          {description ? <p className="page-copy">{description}</p> : null}
        </div>
        {aside ? <div className="hero-aside">{aside}</div> : null}
      </div>
      <div className="page-content">{children}</div>
    </section>
  )
}
