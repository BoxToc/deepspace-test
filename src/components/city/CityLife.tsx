/**
 * Decorative town life: citizens on the sidewalks and two cars on the roads.
 *
 * Purely visual — no state, no server, no gameplay. Each actor's pose is a
 * pure function of the clock (src/city/life.ts). One requestAnimationFrame
 * loop writes a compositor-only `transform` (plus opacity, sprite frame and
 * z-index when they change) to a handful of absolutely positioned <span>s,
 * capped at 30 fps on phone-sized towns. React never re-renders per frame.
 *
 * The loop stops while the town is scrolled out of view (and the browser
 * already pauses rAF in background tabs). With prefers-reduced-motion,
 * citizens stand still at their favourite spots and the cars stay parked off
 * the map; nothing animates.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bounds } from '@/city/iso'
import {
  ACTORS,
  ASPHALT_DROP,
  CITIZEN_SHEET,
  CITIZENS,
  VEHICLE_SHEET,
  VEHICLES,
  actorZ,
  citizenFrame,
  poseAt,
  restPose,
  screenOf,
  timelineOf,
  walkStep,
  type ActorDef,
  type Pose,
} from '@/city/life'
import { SPRITES } from '@/city/sprites'

export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Who is out and about: everyone by day; only the night taxi while the player sleeps. */
function castFor(sleeping: boolean, reduced: boolean): ActorDef[] {
  if (reduced) return sleeping ? [] : CITIZENS
  return sleeping ? VEHICLES.slice(0, 1) : ACTORS
}

interface Drawn {
  z: number
  frame: string
  opacity: number
}

export function CityLife({ bounds, width: W, sleeping }: { bounds: Bounds; width: number; sleeping: boolean }) {
  const layer = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const cast = useMemo(() => castFor(sleeping, reduced), [sleeping, reduced])

  useEffect(() => {
    const root = layer.current
    const stage = root?.parentElement
    if (!root || !stage) return
    const els = Array.from(root.children) as HTMLElement[]
    const timelines = cast.map(timelineOf)
    const drawn: Drawn[] = cast.map(() => ({ z: -1, frame: '', opacity: -1 }))
    let scale = stage.clientWidth / W

    const size = () => {
      scale = stage.clientWidth / W
      cast.forEach((a, i) => {
        const sheet = a.kind === 'citizen' ? CITIZEN_SHEET : VEHICLE_SHEET
        const img = a.kind === 'citizen' ? SPRITES.citizens : SPRITES.vehicles
        const st = els[i].style
        st.width = `${sheet.frameW * scale}px`
        st.height = `${sheet.frameH * scale}px`
        st.backgroundSize = `${img.w * scale}px ${img.h * scale}px`
        drawn[i].frame = '' // re-apply the frame offset at the new scale
      })
    }

    const draw = (i: number, a: ActorDef, pose: Pose, seconds: number) => {
      const el = els[i]
      const d = drawn[i]
      const citizen = a.kind === 'citizen'
      const sheet = citizen ? CITIZEN_SHEET : VEHICLE_SHEET
      let bx: number
      let by = 0
      let flip = false
      if (citizen) {
        const f = citizenFrame(a.variant, pose.facing, walkStep(seconds, pose.moving))
        bx = f.frame * CITIZEN_SHEET.frameW
        flip = f.flip
      } else {
        bx = VEHICLE_SHEET.order.indexOf(pose.facing) * VEHICLE_SHEET.frameW
        by = a.variant * VEHICLE_SHEET.frameH
      }
      const p = screenOf(pose.c, pose.r)
      const x = (p.x - bounds.minX - sheet.anchorX) * scale
      const y = (p.y + (citizen ? 0 : ASPHALT_DROP) - bounds.minY - sheet.anchorY) * scale
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)${flip ? ' scaleX(-1)' : ''}`

      const frame = `${-bx * scale}px ${-by * scale}px`
      if (frame !== d.frame) {
        el.style.backgroundPosition = frame
        d.frame = frame
      }
      const z = actorZ(pose.c, pose.r, a.kind)
      if (z !== d.z) {
        el.style.zIndex = String(z)
        d.z = z
      }
      const opacity = Math.round(pose.opacity * 20) / 20
      if (opacity !== d.opacity) {
        el.style.opacity = String(opacity)
        d.opacity = opacity
      }
    }

    const render = () => {
      const seconds = Date.now() / 1000
      cast.forEach((a, i) => draw(i, a, reduced ? restPose(a) : poseAt(timelines[i], seconds + a.offset), seconds))
    }

    size()
    render()
    const resize = new ResizeObserver(() => {
      size()
      render()
    })
    resize.observe(stage)
    if (reduced) return () => resize.disconnect()

    let raf = 0
    let visible = true
    let last = 0
    const tick = (now: number) => {
      // On a phone-sized town actors move only a few px per second: 30 fps looks
      // the same and halves the main-thread work. Larger towns get every frame.
      const budget = stage.clientWidth < 600 ? 32 : 0
      if (now - last >= budget) {
        last = now
        render()
      }
      raf = visible ? requestAnimationFrame(tick) : 0
    }
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !raf) raf = requestAnimationFrame(tick)
    })
    seen.observe(stage)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      seen.disconnect()
      resize.disconnect()
    }
  }, [cast, reduced, W, bounds])

  return (
    <div ref={layer} className="city-life" aria-hidden data-testid="city-life" data-reduced={reduced}>
      {cast.map((a) => (
        <span
          key={a.id}
          className={`city-actor is-${a.kind}`}
          data-actor={a.id}
          style={{ backgroundImage: `url(${a.kind === 'citizen' ? SPRITES.citizens.src : SPRITES.vehicles.src})` }}
        />
      ))}
    </div>
  )
}
