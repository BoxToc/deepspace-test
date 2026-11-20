/**
 * /home — public dynamic page (providers mounted, no sign-in required).
 * Points signed-in players at their city and invites everyone else to sign in.
 */

import { Link } from 'react-router-dom'
import { useAuthProfileReady } from 'deepspace'
import { APP_NAME } from '../../constants'

export default function HomePage() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">{APP_NAME}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Your sleep powers a tiny city. Sign in to start yours.
      </p>
      {isSignedIn && user && (
        <>
          <p className="text-sm text-muted-foreground">Signed in as {user.name ?? user.email}</p>
          <Link to="/city" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Go to your city →
          </Link>
        </>
      )}
    </div>
  )
}
