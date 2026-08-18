import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { InputText } from 'primereact/inputtext'

/**
 * Public landing page for browsing venues/schedules without logging in.
 *
 * Both search boxes lead to the venue grid (`/explore/venues`): address search
 * matches the venue street/city/state/postal fields, event search currently
 * matches by facility name (event descriptions land in Phase C, which also adds
 * the event-detail destination).
 */
export default function ExploreHomePage() {
  const navigate = useNavigate()
  const [addressQuery, setAddressQuery] = useState('')
  const [eventQuery, setEventQuery] = useState('')

  const submitAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = addressQuery.trim()
    navigate(q ? `/explore/venues?q=${encodeURIComponent(q)}` : '/explore/venues')
  }

  const submitEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = eventQuery.trim()
    navigate(q ? `/explore/venues?q=${encodeURIComponent(q)}` : '/explore/venues')
  }

  return (
    <div className="flex flex-column align-items-center w-full p-3">
      <div className="w-full flex flex-column gap-3" style={{ maxWidth: '64rem' }}>
        <header className="flex align-items-center justify-content-between gap-3">
          <Link to="/" className="flex align-items-center gap-2">
            <i className="pi pi-home" />
            <span className="font-bold">Swimlane</span>
          </Link>
          <nav className="flex align-items-center gap-3">
            <Link to="/explore">Explore</Link>
            <Link to="/explore/venues">Venues</Link>
          </nav>
        </header>

        <Card.Root>
          <Card.Header>
            <Card.Title>Explore</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex flex-column gap-3">
              <form className="flex flex-column gap-2" onSubmit={submitAddress}>
                <label htmlFor="explore-address" className="font-semibold">
                  Find by address
                </label>
                <div className="flex gap-2">
                  <InputText
                    id="explore-address"
                    value={addressQuery}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setAddressQuery(event.target.value)}
                    placeholder="Search by street, city, or postal code"
                    className="w-full"
                  />
                  <Button type="submit">
                    <i className="pi pi-search" />
                    <span className="p-button-label">Search</span>
                  </Button>
                </div>
              </form>

              <form className="flex flex-column gap-2" onSubmit={submitEvent}>
                <label htmlFor="explore-event" className="font-semibold">
                  Find by event
                </label>
                <div className="flex gap-2">
                  <InputText
                    id="explore-event"
                    value={eventQuery}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setEventQuery(event.target.value)}
                    placeholder="Search by facility name"
                    className="w-full"
                  />
                  <Button type="submit">
                    <i className="pi pi-search" />
                    <span className="p-button-label">Search</span>
                  </Button>
                </div>
                <small>Event search currently matches by facility name until event descriptions arrive.</small>
              </form>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  )
}