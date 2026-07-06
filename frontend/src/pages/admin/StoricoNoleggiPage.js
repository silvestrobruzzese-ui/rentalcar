import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, api } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { 
  ChevronLeft, User, Car, CalendarDays, CreditCard, 
  FileText, Eye, Printer, CheckCircle, XCircle, Clock, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

const formatDateIT = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.substring(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  try { const dt = new Date(dateStr); return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`; } catch { return dateStr; }
};

const statusLabels = {
  bozza: { label: 'Bozza', color: 'bg-slate-100 text-slate-700' },
  in_verifica: { label: 'In Verifica', color: 'bg-yellow-100 text-yellow-700' },
  approvata: { label: 'Approvata', color: 'bg-blue-100 text-blue-700' },
  contratto_generato: { label: 'Contratto Generato', color: 'bg-purple-100 text-purple-700' },
  consegnato: { label: 'Consegnato', color: 'bg-green-100 text-green-700' },
  chiuso: { label: 'Chiuso', color: 'bg-slate-200 text-slate-600' },
  annullata: { label: 'Annullata', color: 'bg-red-100 text-red-700' }
};

export default function StoricoNoleggiPage() {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.get(`/clienti/${clienteId}/storico-noleggi`, token);
        setData(result);
      } catch (error) {
        toast.error('Errore nel caricamento dello storico');
        navigate('/admin/clienti');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clienteId, token, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { cliente, statistiche, prenotazioni } = data;

  return (
    <div className="space-y-6" data-testid="storico-noleggi-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/admin/clienti">
            <Button variant="ghost" size="sm"><ChevronLeft className="w-4 h-4 mr-1" /> Clienti</Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Storico Noleggi
            </h2>
            <p className="text-sm text-slate-500">{cliente.nome} {cliente.cognome}</p>
          </div>
        </div>
      </div>

      {/* Cliente Info & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Cliente Card */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Dati Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>{cliente.nome} {cliente.cognome}</strong></p>
            <p className="text-slate-500">{cliente.email}</p>
            <p className="text-slate-500">{cliente.cellulare}</p>
            <p className="text-slate-500 text-xs mt-2">CF: {cliente.codice_fiscale}</p>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <Card className="border-slate-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarDays className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{statistiche.totale_noleggi}</p>
                <p className="text-xs text-blue-600">Noleggi Totali</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{statistiche.noleggi_completati}</p>
                <p className="text-xs text-green-600">Completati</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">€{statistiche.totale_speso.toFixed(2)}</p>
                <p className="text-xs text-yellow-600">Totale Speso</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storico Noleggi Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" /> Elenco Noleggi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {prenotazioni.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Car className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessun noleggio trovato per questo cliente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prenotazioni.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="text-sm">{formatDateIT(p.created_at)}</p>
                        <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="font-medium">{p.veicolo_marca} {p.veicolo_modello}</p>
                            <p className="text-xs text-slate-500">{p.veicolo_targa}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{p.data_ritiro} → {p.data_riconsegna}</p>
                        <p className="text-xs text-slate-500">{p.durata_giorni} giorni</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">€{p.tariffa_base?.toFixed(2)}</p>
                        {p.totale_addebiti_rientro > 0 && (
                          <p className="text-xs text-red-500">+ €{p.totale_addebiti_rientro.toFixed(2)} addebiti</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[p.status]?.color || 'bg-gray-100'}`}>
                          {statusLabels[p.status]?.label || p.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {p.contratto_generato && (
                          <Link to={`/admin/contratto/${p.id}`}>
                            <Button variant="ghost" size="sm" className="text-green-600" title="Stampa Contratto">
                              <Printer className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        <Link to={`/admin/prenotazioni/${p.id}`}>
                          <Button variant="ghost" size="sm" title="Dettagli">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
