import { useEffect, useState } from "react"

import { onUsersSnapshot } from "fire/services"
import type { UserProfile } from "@/types"

/**
 * Everyone with an account, alphabetical.
 *
 * Used to ask people into a planning session. A picker rather than a typed
 * address, because this is a household app with a handful of accounts and
 * "invite by email" invites a typo that produces an ask nobody ever sees — the
 * one failure mode of an invite you cannot debug from either end.
 */
const useEveryone = (): UserProfile[] => {
  const [people, setPeople] = useState<UserProfile[]>([])

  useEffect(() => onUsersSnapshot(setPeople), [])

  return people
}

export default useEveryone
