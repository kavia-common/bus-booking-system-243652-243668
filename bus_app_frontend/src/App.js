import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import { apiGet, apiPost } from './api/client';

function money(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n));
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
}

// PUBLIC_INTERFACE
function App() {
  /** Main Bus Booking MVP UI (public booking + simple admin). */
  const [tab, setTab] = useState('book'); // book | admin
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search state
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Seat state
  const [seatInfo, setSeatInfo] = useState(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);

  // Passenger state
  const [passengerName, setPassengerName] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');

  // Booking confirmation
  const [booking, setBooking] = useState(null);

  // Admin state
  const [adminToken, setAdminToken] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin');

  const [adminRoutes, setAdminRoutes] = useState([]);
  const [adminBuses, setAdminBuses] = useState([]);

  const [newRoute, setNewRoute] = useState({ origin: '', destination: '', distance_km: '', duration_min: '' });
  const [newBus, setNewBus] = useState({ code: '', name: '', seat_layout_json: '' });
  const [newTrip, setNewTrip] = useState({ route_id: '', bus_id: '', departure_time: '', price: '' });

  const seatBookedSet = useMemo(() => {
    const s = new Set();
    if (seatInfo?.booked_seat_ids) seatInfo.booked_seat_ids.forEach((id) => s.add(id));
    return s;
  }, [seatInfo]);

  const resetBookingFlow = () => {
    setSelectedTrip(null);
    setSeatInfo(null);
    setSelectedSeatIds([]);
    setPassengerName('');
    setPassengerEmail('');
    setPassengerPhone('');
    setBooking(null);
  };

  const loadTrips = async () => {
    setError('');
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (origin.trim()) q.set('origin', origin.trim());
      if (destination.trim()) q.set('destination', destination.trim());
      const data = await apiGet(`/api/trips?${q.toString()}`);
      setTrips(data.trips || []);
    } catch (e) {
      setError(`Failed to load trips: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSeats = async (tripId) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiGet(`/api/trips/${tripId}/seats`);
      setSeatInfo(data);
      setSelectedSeatIds([]);
    } catch (e) {
      setError(`Failed to load seats: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeat = (seat) => {
    if (!seat || seat.is_active !== 1) return;
    if (seatBookedSet.has(seat.id)) return;

    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.id)) return prev.filter((x) => x !== seat.id);
      return [...prev, seat.id];
    });
  };

  const submitBooking = async () => {
    setError('');

    if (!selectedTrip) return setError('Select a trip first.');
    if (selectedSeatIds.length === 0) return setError('Select at least one seat.');
    if (passengerName.trim().length < 2) return setError('Enter passenger name.');
    if (!passengerEmail.includes('@')) return setError('Enter a valid email.');

    setLoading(true);
    try {
      const payload = {
        trip_id: selectedTrip.id,
        seat_ids: selectedSeatIds,
        passenger_name: passengerName.trim(),
        passenger_email: passengerEmail.trim(),
        passenger_phone: passengerPhone.trim() || null,
      };
      const data = await apiPost('/api/bookings', payload);
      setBooking(data);
    } catch (e) {
      // backend returns plain text on error
      setError(`Booking failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const adminLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/api/admin/login', { username: adminUsername, password: adminPassword });
      setAdminToken(data.token);
    } catch (e) {
      setError(`Admin login failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const adminLoadCatalog = async (token) => {
    setError('');
    setLoading(true);
    try {
      const [routes, buses] = await Promise.all([
        (async () => {
          const res = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:3001'}/api/admin/routes`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })(),
        (async () => {
          const res = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:3001'}/api/admin/buses`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })(),
      ]);
      setAdminRoutes(routes);
      setAdminBuses(buses);
    } catch (e) {
      setError(`Admin load failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const adminCreateRoute = async () => {
    setError('');
    if (!adminToken) return setError('Login first.');
    if (!newRoute.origin.trim() || !newRoute.destination.trim()) return setError('Origin and destination required.');

    setLoading(true);
    try {
      const payload = {
        origin: newRoute.origin.trim(),
        destination: newRoute.destination.trim(),
        distance_km: newRoute.distance_km ? Number(newRoute.distance_km) : null,
        duration_min: newRoute.duration_min ? Number(newRoute.duration_min) : null,
      };
      await apiPost('/api/admin/routes', payload, adminToken);
      setNewRoute({ origin: '', destination: '', distance_km: '', duration_min: '' });
      await adminLoadCatalog(adminToken);
    } catch (e) {
      setError(`Create route failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const adminCreateBus = async () => {
    setError('');
    if (!adminToken) return setError('Login first.');
    if (!newBus.code.trim() || !newBus.name.trim()) return setError('Bus code and name required.');

    setLoading(true);
    try {
      const payload = { code: newBus.code.trim(), name: newBus.name.trim(), seat_layout_json: newBus.seat_layout_json.trim() || null };
      await apiPost('/api/admin/buses', payload, adminToken);
      setNewBus({ code: '', name: '', seat_layout_json: '' });
      await adminLoadCatalog(adminToken);
    } catch (e) {
      setError(`Create bus failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const adminCreateTrip = async () => {
    setError('');
    if (!adminToken) return setError('Login first.');
    if (!newTrip.route_id || !newTrip.bus_id || !newTrip.departure_time || !newTrip.price) return setError('All trip fields required.');

    setLoading(true);
    try {
      const payload = {
        route_id: Number(newTrip.route_id),
        bus_id: Number(newTrip.bus_id),
        departure_time: newTrip.departure_time,
        price: Number(newTrip.price),
        status: 'scheduled',
      };
      await apiPost('/api/admin/trips', payload, adminToken);
      setNewTrip({ route_id: '', bus_id: '', departure_time: '', price: '' });
    } catch (e) {
      setError(`Create trip failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial trip load
    loadTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'admin' && adminToken) adminLoadCatalog(adminToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, adminToken]);

  const totalPrice = useMemo(() => {
    if (!selectedTrip) return 0;
    return Number(selectedTrip.price) * selectedSeatIds.length;
  }, [selectedTrip, selectedSeatIds]);

  return (
    <div className="appShell">
      <header className="header">
        <div className="headerInner">
          <div className="brand" aria-label="RetroRide bus booking">
            <span className="brandMark">RR//MVP</span>
            <div>
              <div className="brandTitle">RetroRide</div>
              <div className="brandSub">Bus booking, but make it neon.</div>
            </div>
          </div>

          <nav className="nav" aria-label="Primary navigation">
            <button className={`chip ${tab === 'book' ? 'chipActive' : ''}`} onClick={() => { setTab('book'); setError(''); }}>
              Book a Trip
            </button>
            <button className={`chip ${tab === 'admin' ? 'chipActive' : ''}`} onClick={() => { setTab('admin'); setError(''); }}>
              Admin
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {error ? (
          <div className="errorBox" role="alert" aria-live="polite">
            <strong>Error:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{error}</span>
          </div>
        ) : null}
        {loading ? <p className="muted">Loading…</p> : null}

        {tab === 'book' ? (
          <div className="grid">
            <section className="card">
              <h2 className="h2">Find Trips</h2>
              <p className="muted">Search by city. Pick a trip. Choose seats. Confirm.</p>

              <div className="row" style={{ marginTop: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="label">Origin</div>
                  <input className="input" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g., San Francisco" />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="label">Destination</div>
                  <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g., San Jose" />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button className="btn btnPrimary" onClick={loadTrips} disabled={loading}>
                    Search
                  </button>
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button className="btn" onClick={resetBookingFlow} disabled={loading}>
                    Reset
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <table className="table" aria-label="Trips results">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Departure</th>
                      <th>Bus</th>
                      <th>Price</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {trips.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="muted">
                          No trips found. Try a broader search.
                        </td>
                      </tr>
                    ) : null}
                    {trips.map((t) => (
                      <tr key={t.id} style={selectedTrip?.id === t.id ? { background: 'rgba(59,130,246,0.06)' } : undefined}>
                        <td>
                          <strong>{t.route.origin}</strong> → <strong>{t.route.destination}</strong>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{t.departure_time}</td>
                        <td>{t.bus.name}</td>
                        <td>{money(t.price)}</td>
                        <td>
                          <button
                            className="btn btnAccent"
                            onClick={() => {
                              setSelectedTrip(t);
                              setBooking(null);
                              loadSeats(t.id);
                            }}
                            disabled={loading}
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="card">
              <h2 className="h2">Seats & Passenger</h2>
              {!selectedTrip ? (
                <div className="banner">
                  Select a trip to view seat availability.
                </div>
              ) : null}

              {selectedTrip ? (
                <>
                  <div className="banner" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 900 }}>
                      {selectedTrip.route.origin} → {selectedTrip.route.destination}
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      Departs: <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedTrip.departure_time}</span>
                    </div>
                    <div className="muted">Base fare: {money(selectedTrip.price)} per seat</div>
                  </div>

                  {seatInfo ? (
                    <>
                      <div className="seatGrid" aria-label="Seat selection">
                        {seatInfo.seats.map((s) => {
                          const booked = seatBookedSet.has(s.id);
                          const inactive = s.is_active !== 1;
                          const selected = selectedSeatIds.includes(s.id);

                          const cls = [
                            'seat',
                            selected ? 'seatSelected' : '',
                            booked ? 'seatBooked' : '',
                            inactive ? 'seatInactive' : '',
                          ].join(' ');

                          return (
                            <button
                              key={s.id}
                              type="button"
                              className={cls}
                              onClick={() => toggleSeat(s)}
                              disabled={booked || inactive}
                              aria-pressed={selected}
                              title={booked ? 'Booked' : inactive ? 'Inactive' : 'Available'}
                            >
                              {s.seat_no}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div className="muted">
                          Selected seats: <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedSeatIds.length ? selectedSeatIds.join(', ') : 'none'}</span>
                        </div>
                        <div style={{ marginTop: 6, fontWeight: 900 }}>
                          Total: {money(totalPrice)}
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div className="label">Passenger name</div>
                        <input className="input" value={passengerName} onChange={(e) => setPassengerName(e.target.value)} placeholder="Jamie Appleseed" />
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <div className="label">Passenger email</div>
                        <input className="input" value={passengerEmail} onChange={(e) => setPassengerEmail(e.target.value)} placeholder="jamie@example.com" />
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <div className="label">Passenger phone (optional)</div>
                        <input className="input" value={passengerPhone} onChange={(e) => setPassengerPhone(e.target.value)} placeholder="+1 555 0123" />
                      </div>

                      <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                        <button className="btn btnPrimary" onClick={submitBooking} disabled={loading || !!booking}>
                          Confirm Booking
                        </button>
                        <button className="btn" onClick={() => selectedTrip && loadSeats(selectedTrip.id)} disabled={loading}>
                          Refresh seats
                        </button>
                      </div>

                      {booking ? (
                        <div className="banner" style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 900 }}>Confirmed!</div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            Booking ref: <span style={{ fontFamily: 'var(--font-mono)' }}>{booking.booking_ref}</span>
                          </div>
                          <div className="muted">Seats: <span style={{ fontFamily: 'var(--font-mono)' }}>{booking.seat_ids.join(', ')}</span></div>
                          <div className="muted">Total: {money(booking.total_amount)}</div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="muted">Loading seat map…</p>
                  )}
                </>
              ) : null}
            </aside>
          </div>
        ) : null}

        {tab === 'admin' ? (
          <section className="card">
            <h2 className="h2">Admin Console (MVP)</h2>
            <p className="muted">
              Default credentials: <span style={{ fontFamily: 'var(--font-mono)' }}>admin/admin</span>. Token is static (dev-only).
            </p>

            {!adminToken ? (
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="label">Username</div>
                  <input className="input" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="label">Password</div>
                  <input className="input" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button className="btn btnPrimary" onClick={adminLogin} disabled={loading}>
                    Login
                  </button>
                </div>
              </div>
            ) : (
              <div className="banner" style={{ marginTop: 10 }}>
                Logged in. Bearer token: <span style={{ fontFamily: 'var(--font-mono)' }}>{adminToken}</span>
              </div>
            )}

            <div className="grid" style={{ marginTop: 14 }}>
              <div className="card">
                <h3 className="h2" style={{ fontSize: 16 }}>Routes</h3>
                <div className="row">
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div className="label">Origin</div>
                    <input className="input" value={newRoute.origin} onChange={(e) => setNewRoute({ ...newRoute, origin: e.target.value })} />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div className="label">Destination</div>
                    <input className="input" value={newRoute.destination} onChange={(e) => setNewRoute({ ...newRoute, destination: e.target.value })} />
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div className="label">Distance (km)</div>
                    <input className="input" value={newRoute.distance_km} onChange={(e) => setNewRoute({ ...newRoute, distance_km: e.target.value })} />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div className="label">Duration (min)</div>
                    <input className="input" value={newRoute.duration_min} onChange={(e) => setNewRoute({ ...newRoute, duration_min: e.target.value })} />
                  </div>
                  <div style={{ alignSelf: 'flex-end' }}>
                    <button className="btn btnAccent" onClick={adminCreateRoute} disabled={loading || !adminToken}>
                      Add Route
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <table className="table" aria-label="Admin routes table">
                    <thead>
                      <tr><th>ID</th><th>Origin</th><th>Destination</th></tr>
                    </thead>
                    <tbody>
                      {adminRoutes.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{r.id}</td>
                          <td>{r.origin}</td>
                          <td>{r.destination}</td>
                        </tr>
                      ))}
                      {adminRoutes.length === 0 ? <tr><td colSpan="3" className="muted">No routes loaded.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <h3 className="h2" style={{ fontSize: 16 }}>Buses</h3>
                <div className="row">
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div className="label">Code</div>
                    <input className="input" value={newBus.code} onChange={(e) => setNewBus({ ...newBus, code: e.target.value })} placeholder="BUS-300" />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div className="label">Name</div>
                    <input className="input" value={newBus.name} onChange={(e) => setNewBus({ ...newBus, name: e.target.value })} placeholder="Neon Cruiser" />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div className="label">Seat layout (optional text)</div>
                  <input className="input" value={newBus.seat_layout_json} onChange={(e) => setNewBus({ ...newBus, seat_layout_json: e.target.value })} placeholder="(leave blank for default)" />
                </div>
                <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
                  <button className="btn btnAccent" onClick={adminCreateBus} disabled={loading || !adminToken}>
                    Add Bus
                  </button>
                  <button className="btn" onClick={() => adminToken && adminLoadCatalog(adminToken)} disabled={loading || !adminToken}>
                    Refresh
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <table className="table" aria-label="Admin buses table">
                    <thead>
                      <tr><th>ID</th><th>Code</th><th>Name</th></tr>
                    </thead>
                    <tbody>
                      {adminBuses.map((b) => (
                        <tr key={b.id}>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{b.id}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{b.code}</td>
                          <td>{b.name}</td>
                        </tr>
                      ))}
                      {adminBuses.length === 0 ? <tr><td colSpan="3" className="muted">No buses loaded.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h3 className="h2" style={{ fontSize: 16 }}>Create Trip</h3>
              <p className="muted">Use route/bus IDs from the tables above.</p>
              <div className="row">
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div className="label">Route ID</div>
                  <input className="input" value={newTrip.route_id} onChange={(e) => setNewTrip({ ...newTrip, route_id: e.target.value })} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div className="label">Bus ID</div>
                  <input className="input" value={newTrip.bus_id} onChange={(e) => setNewTrip({ ...newTrip, bus_id: e.target.value })} />
                </div>
                <div style={{ flex: 2, minWidth: 220 }}>
                  <div className="label">Departure time (ISO)</div>
                  <input className="input" value={newTrip.departure_time} onChange={(e) => setNewTrip({ ...newTrip, departure_time: e.target.value })} placeholder="2026-01-01T15:00:00" />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div className="label">Price</div>
                  <input className="input" value={newTrip.price} onChange={(e) => setNewTrip({ ...newTrip, price: e.target.value })} placeholder="19.99" />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button className="btn btnPrimary" onClick={adminCreateTrip} disabled={loading || !adminToken}>
                    Add Trip
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
