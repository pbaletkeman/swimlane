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
    <div className="explore-page">
      <div className="explore-container">
        <header className="explore-header">
          <Link to="/" className="explore-brand">
            <i className="pi pi-home" />
            <span>Swimlane</span>
          </Link>
          <nav className="explore-nav">
            <Link to="/explore" className="explore-nav-link">
              Explore
            </Link>
            <Link to="/explore/venues" className="explore-nav-link">
              Venues
            </Link>
          </nav>
        </header>

        <Card.Root>
          <Card.Header>
            <Card.Title>Explore</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="explore-search-form">
              <form className="explore-search-block" onSubmit={submitAddress}>
                <label htmlFor="explore-address" className="explore-search-label">
                  Find by address
                </label>
                <div className="explore-search-row">
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

              <form className="explore-search-block" onSubmit={submitEvent}>
                <label htmlFor="explore-event" className="explore-search-label">
                  Find by event
                </label>
                <div className="explore-search-row">
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
                <small className="explore-hint">
                  Event search currently matches by facility name until event descriptions arrive.
                </small>
              </form>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  )
}