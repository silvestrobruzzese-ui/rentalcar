import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const DAYS_SHORT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

// Status colors aligned with calendar page
const STATUS_HUE = {
  bozza: { h: 220, s: 10 },
  in_verifica: { h: 45, s: 85 },
  approvata: { h: 270, s: 60 },
  contratto_generato: { h: 215, s: 80 },
  consegnato: { h: 150, s: 70 },
  chiuso: { h: 210, s: 15 },
  annullata: { h: 0, s: 75 },
  blocco: { h: 30, s: 85 },
};

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
};

const getShade = (id, status) => {
  const base = STATUS_HUE[status] || STATUS_HUE.bozza;
  const offset = hashString(id) % 30;
  const h = (base.h + offset - 15 + 360) % 360;
  const s = Math.min(85, base.s + (hashString(id) % 15));
  return {
    bg: `hsl(${h}, ${s}%, 70%)`,
    border: `hsl(${h}, ${s}%, 45%)`,
    text: `hsl(${h}, ${Math.min(s + 10, 90)}%, 25%)`,
  };
};

const isBlocco = (booking) => 
  booking?.cliente_id === 'BLOCCO_CALENDARIO' || 
  booking?.cliente_nome === 'BLOCCO CALENDARIO' ||
  !booking?.cliente_id;

const getBannerLabel = (booking) => {
  if (isBlocco(booking)) {
    // Use first two words of the block title (stored in note_admin or cliente_nome)
    const txt = booking.note_admin || booking.cliente_nome || 'BLOCCO';
    const words = String(txt).trim().split(/\s+/).slice(0, 2);
    return words.join(' ');
  }
  return booking.cliente_nome || 'Cliente';
};

const formatDateISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function LegendaPrenotazioniPage() {
  const { token } = useAuth();
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [veicoli, setVeicoli] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchAll = async () => {
    try {
      const [pRes, vRes] = await Promise.all([
        axios.get(`${API}/api/prenotazioni`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/api/vehicles`)
      ]);
      setPrenotazioni(pRes.data || []);
      setVeicoli(vRes.data || []);
    } catch (e) {
      console.error('Errore caricamento legenda:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [token]);

  // Realtime refresh every 15s and on window focus
  useEffect(() => {
    const interval = setInterval(fetchAll, 15000);
    const onFocus = () => fetchAll();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Days of the displayed month
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return {
        date: d,
        iso: formatDateISO(d),
        num: i + 1,
        weekday: DAYS_SHORT[d.getDay()],
      };
    });
  }, [currentDate]);

  // Bookings for current month, grouped by vehicle_id
  const bookingsByVehicle = useMemo(() => {
    const monthStart = formatDateISO(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    const monthEnd = formatDateISO(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
    const map = new Map();
    prenotazioni.forEach(p => {
      if (p.status === 'annullata') return;
      if (!p.veicolo_id || p.veicolo_id === 'generico') return;
      // overlaps with current month
      if (p.data_ritiro > monthEnd || p.data_riconsegna < monthStart) return;
      if (!map.has(p.veicolo_id)) map.set(p.veicolo_id, []);
      map.get(p.veicolo_id).push(p);
    });
    return map;
  }, [prenotazioni, currentDate]);

  const goPrev = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };
  const goToday = () => setCurrentDate(new Date());

  const CELL_W = 56; // px per day column

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">Caricamento legenda prenotazioni...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="legenda-prenotazioni-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Legenda Prenotazioni
          </h1>
          <p className="text-sm text-slate-500">Vista timeline mensile per veicolo</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} data-testid="prev-month-btn">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-md font-semibold text-slate-900 min-w-[160px] text-center">
            {MONTHS_IT[currentDate.getMonth()]} {currentDate.getFullYear()}
          </div>
          <Button variant="outline" size="sm" onClick={goNext} data-testid="next-month-btn">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            <Calendar className="w-4 h-4 mr-1" /> Oggi
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs bg-white p-3 rounded-md border border-slate-200">
        <span className="font-semibold text-slate-700 mr-2">Stati:</span>
        {Object.entries(STATUS_HUE).map(([status, hue]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span 
              className="inline-block w-3 h-3 rounded-sm border" 
              style={{ backgroundColor: `hsl(${hue.h}, ${hue.s}%, 70%)`, borderColor: `hsl(${hue.h}, ${hue.s}%, 45%)` }}
            />
            <span className="capitalize text-slate-600">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Timeline grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex">
          {/* Fixed left column (vehicles) */}
          <div className="flex-shrink-0 w-48 border-r border-slate-200 bg-slate-50">
            <div className="h-14 border-b border-slate-200 flex items-center px-3 font-semibold text-slate-700 text-sm sticky top-0 bg-slate-50">
              Veicolo
            </div>
            {veicoli.map(v => (
              <div 
                key={v.id} 
                className="h-16 border-b border-slate-100 flex flex-col justify-center px-3"
                data-testid={`veicolo-row-${v.id}`}
              >
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {v.marca} {v.modello}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {v.targa} {v.colore ? `· ${v.colore.toUpperCase()}` : ''}
                </p>
              </div>
            ))}
            {veicoli.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">Nessun veicolo</div>
            )}
          </div>

          {/* Scrollable days area */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ minWidth: daysInMonth.length * CELL_W }}>
              {/* Day headers */}
              <div className="h-14 border-b border-slate-200 flex sticky top-0 bg-white z-10">
                {daysInMonth.map(d => {
                  const isToday = formatDateISO(new Date()) === d.iso;
                  const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                  return (
                    <div 
                      key={d.iso}
                      className={`flex flex-col items-center justify-center border-r border-slate-100 text-xs ${isWeekend ? 'bg-slate-50' : ''} ${isToday ? 'bg-blue-50' : ''}`}
                      style={{ width: CELL_W, flexShrink: 0 }}
                    >
                      <span className={`font-bold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{d.num}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{d.weekday}</span>
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              {veicoli.map(v => {
                const bookings = bookingsByVehicle.get(v.id) || [];
                return (
                  <div 
                    key={v.id} 
                    className="h-16 border-b border-slate-100 relative"
                    style={{ width: daysInMonth.length * CELL_W }}
                    data-testid={`timeline-row-${v.id}`}
                  >
                    {/* Day separators */}
                    {daysInMonth.map(d => {
                      const isToday = formatDateISO(new Date()) === d.iso;
                      const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
                      return (
                        <div 
                          key={d.iso}
                          className={`absolute top-0 bottom-0 border-r border-slate-100 ${isWeekend ? 'bg-slate-50/40' : ''} ${isToday ? 'bg-blue-50/40' : ''}`}
                          style={{ left: (d.num - 1) * CELL_W, width: CELL_W }}
                        />
                      );
                    })}

                    {/* Booking banners */}
                    {bookings.map(b => {
                      const monthStart = formatDateISO(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
                      const monthEnd = formatDateISO(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
                      const startISO = b.data_ritiro < monthStart ? monthStart : b.data_ritiro;
                      const endISO = b.data_riconsegna > monthEnd ? monthEnd : b.data_riconsegna;
                      const startDay = parseInt(startISO.split('-')[2], 10);
                      const endDay = parseInt(endISO.split('-')[2], 10);
                      const left = (startDay - 1) * CELL_W + 2;
                      const width = (endDay - startDay + 1) * CELL_W - 4;
                      const status = isBlocco(b) ? 'blocco' : (b.status || 'bozza');
                      const shade = getShade(b.id, status);
                      const label = getBannerLabel(b);
                      const startsBeforeMonth = b.data_ritiro < monthStart;
                      const endsAfterMonth = b.data_riconsegna > monthEnd;
                      return (
                        <Link
                          key={b.id}
                          to={`/admin/contratto/${b.id}`}
                          className="absolute top-2 bottom-2 rounded-md px-2 flex items-center text-xs font-semibold overflow-hidden shadow-sm border-l-4 cursor-pointer hover:opacity-90 hover:shadow-md hover:ring-2 hover:ring-blue-400 transition-all"
                          style={{
                            left,
                            width: Math.max(width, 30),
                            backgroundColor: shade.bg,
                            borderLeftColor: shade.border,
                            color: shade.text,
                            textDecoration: 'none',
                          }}
                          title={`${label} - ${b.data_ritiro} → ${b.data_riconsegna} (${status.replace('_', ' ')}) — Clicca per aprire il contratto`}
                          data-testid={`booking-banner-${b.id}`}
                        >
                          {startsBeforeMonth && <span className="mr-1">←</span>}
                          <span className="truncate">{label}</span>
                          {endsAfterMonth && <span className="ml-1">→</span>}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {veicoli.length === 0 && (
        <div className="text-center text-slate-400 py-8">
          Nessun veicolo in flotta. Aggiungi veicoli per visualizzare la legenda.
        </div>
      )}
    </div>
  );
}
