import { Button, SectionHeading } from "components"
import type { SessionInvite } from "@/types"

interface SessionInvitesProps {
  invites: SessionInvite[]
  onAccept: (invite: SessionInvite) => void
  onDecline: (invite: SessionInvite) => void
  isBusy: boolean
}

/**
 * Asks to join a session, waiting on your own tab.
 *
 * Deliberately **not** on the Plan tab: an ask is addressed to you, not to any
 * session, and you cannot see the week it belongs to until you have taken it.
 * The Plan tab shows what you are already in; this is the door.
 */
const SessionInvites = ({ invites, onAccept, onDecline, isBusy }: SessionInvitesProps) => {
  if (invites.length === 0) return null

  return (
    <>
      <SectionHeading meta={`${invites.length} ask${invites.length === 1 ? "" : "s"}`}>
        Waiting on you
      </SectionHeading>

      <ul>
        {invites.map((invite) => (
          <li
            key={invite.id}
            className='blueprint mt-3 border-steel bg-steel-100 p-3.5'>
            <p className='font-heading text-[20px] font-semibold'>{invite.sessionName}</p>
            <p className='mt-1 text-[14.5px] leading-snug'>
              {invite.fromName} wants you in on the planning — cooking for {invite.covers}.
            </p>
            <p className='mt-0.5 text-[13px] text-muted'>
              You'll share the week and one shopping list.
            </p>
            <div className='mt-3 grid grid-cols-2 gap-2'>
              <Button
                variant='primary'
                disabled={isBusy}
                onClick={() => onAccept(invite)}
                className='mt-0 mr-0'>
                Yes, chef
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => onDecline(invite)}
                className='mt-0 mr-0 bg-ground'>
                Not this time
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default SessionInvites
