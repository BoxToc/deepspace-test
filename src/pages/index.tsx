/**
 * Landing page — a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * That makes it cheap to serve and safe for logged-out / crawler traffic.
 *
 * Need live data or auth here? Move this file to src/pages/(app)/index.tsx
 * and it becomes a dynamic page. Conversely, any page you want to keep static
 * (marketing, docs, legal) belongs at this top level.
 *
 * Top-level pages are also prerendered to static HTML at build
 * (prerender.ts, via vite.config.ts) so crawlers read real content.
 * Keep them renderable without a browser: no window/document during render,
 * prose in HTML text, reveal animations in CSS keyframes rather than JS-driven
 * initial states. `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { Coins, Moon, Zap } from 'lucide-react'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

const STEPS = [
  {
    icon: Moon,
    title: 'Sleep',
    text: 'Tap Start Sleep at bedtime and Wake Up in the morning. Each hour of rest becomes energy, once a day.',
  },
  {
    icon: Zap,
    title: 'Power your town',
    text: 'Energy fills your battery. While it lasts, the streetlights glow and every building runs, even while you are away.',
  },
  {
    icon: Coins,
    title: 'Earn and upgrade',
    text: 'Powered buildings earn coins. Spend them to grow the Power Station, houses, shop and park through three levels.',
  },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <main data-testid="static-landing" className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16">
        <p className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">{APP_NAME}</p>
        <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Sleep well. Power your city.
        </h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          Every night of rest becomes electricity for a tiny isometric town. Keep the
          lights on, earn coins, and upgrade your buildings.
        </p>
        <Link
          to="/city"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Enter the app
        </Link>

        <img
          src="/landing-town.webp"
          width={720}
          height={496}
          alt="A miniature isometric town at full upgrade: a red-brick power station with a cooling tower, two tall houses, a three-storey shop and a park fountain."
          className="mt-12 h-auto w-full max-w-2xl rounded-2xl"
          decoding="async"
        />

        <section aria-labelledby="how-it-works" className="mt-14 w-full">
          <h2 id="how-it-works" className="mb-6 text-2xl font-semibold text-foreground">
            How it works
          </h2>
          <ol className="grid gap-4 text-left sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-xl border border-border p-5">
                <span className="mb-3 grid size-9 place-items-center rounded-full bg-amber-400/15 text-amber-400" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <h3 className="font-medium text-foreground">
                  {i + 1}. {title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-xs text-muted-foreground">
            Your city and sleep records are private to your account. Buildings use CC0 art by Kenney.
          </p>
        </section>
      </main>
    </>
  )
}
