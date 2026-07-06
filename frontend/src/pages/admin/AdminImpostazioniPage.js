import { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Building2, FileText, Shield, Package, Plus, Trash2, Save, Upload, X, Calendar, Euro, Car, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminImpostazioniPage() {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  
  // Agenzia
  const [agenzia, setAgenzia] = useState({
    ragione_sociale: 'Soverato Rental',
    slogan: 'Il noleggio che conviene',
    indirizzo: 'Corso Umberto, 220',
    cap: '88068',
    comune: 'Soverato',
    provincia: 'CZ',
    regione: 'Calabria',
    piva: '03406230791',
    cf: '03406230791',
    telefono: '3342370420',
    email: 'soveratorental@libero.it',
    logo_url: '/images/logo_agenzia.png'
  });
  
  // Altri dati
  const [condizioni, setCondizioni] = useState('');
  const [franchigie, setFranchigie] = useState([]);
  const [servizi, setServizi] = useState([]);
  const [tariffeStagionali, setTariffeStagionali] = useState([]);
  const [veicoli, setVeicoli] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Dialogs
  const [franchigiaDialogOpen, setFranchigiaDialogOpen] = useState(false);
  const [servizioDialogOpen, setServizioDialogOpen] = useState(false);
  const [tariffaDialogOpen, setTariffaDialogOpen] = useState(false);
  const [editTariffaDialogOpen, setEditTariffaDialogOpen] = useState(false);
  
  const [newFranchigia, setNewFranchigia] = useState({ nome: '', descrizione: '', importo_massimo: '', costo_giornaliero: '' });
  const [newServizio, setNewServizio] = useState({ nome: '', descrizione: '', prezzo_unitario: '', unita: 'giorno' });
  const [newTariffa, setNewTariffa] = useState({ 
    nome: '', 
    data_inizio: '', 
    data_fine: '', 
    tariffa_giornaliera: '',
    descrizione: '',
    veicolo_id: 'tutti'
  });
  const [editTariffa, setEditTariffa] = useState(null);

  const fetchData = async () => {
    try {
      const [agenziaRes, cond, fran, serv, tariffe, veicoliRes] = await Promise.all([
        api.get('/settings/agenzia', token).catch(() => ({ data: agenzia })),
        api.get('/settings/condizioni-generali', token).catch(() => ({ testo: '' })),
        api.get('/franchigie', token).catch(() => []),
        api.get('/servizi-supplementari', token).catch(() => []),
        api.get('/settings/tariffe-stagionali', token).catch(() => []),
        api.get('/vehicles', token).catch(() => [])
      ]);
      
      if (agenziaRes && Object.keys(agenziaRes).length > 0) {
        setAgenzia(prev => ({ ...prev, ...agenziaRes }));
      }
      setCondizioni(cond?.testo || '');
      setFranchigie(Array.isArray(fran) ? fran : []);
      setServizi(Array.isArray(serv) ? serv : []);
      setTariffeStagionali(Array.isArray(tariffe) ? tariffe : []);
      setVeicoli(Array.isArray(veicoliRes) ? veicoliRes : []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  // ========== AGENZIA ==========
  const handleSaveAgenzia = async () => {
    setSaving(true);
    try {
      await api.put('/settings/agenzia', agenzia, token);
      toast.success('Dati agenzia salvati!');
    } catch (error) {
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File troppo grande (max 5MB)');
      return;
    }
    
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');
      
      const res = await axios.post(`${API}/api/upload/image`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setAgenzia(prev => ({ ...prev, logo_url: res.data.url }));
      toast.success('Logo caricato!');
    } catch (error) {
      toast.error('Errore nel caricamento');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setAgenzia(prev => ({ ...prev, logo_url: '' }));
  };

  // ========== CONDIZIONI ==========
  const handleSaveCondizioni = async () => {
    setSaving(true);
    try {
      await api.put('/settings/condizioni-generali', { testo: condizioni }, token);
      toast.success('Condizioni salvate');
    } catch (error) {
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  // ========== FRANCHIGIE ==========
  const handleAddFranchigia = async () => {
    try {
      await api.post('/franchigie', {
        ...newFranchigia,
        importo_massimo: parseFloat(newFranchigia.importo_massimo),
        costo_giornaliero: parseFloat(newFranchigia.costo_giornaliero)
      }, token);
      toast.success('Franchigia aggiunta');
      setFranchigiaDialogOpen(false);
      setNewFranchigia({ nome: '', descrizione: '', importo_massimo: '', costo_giornaliero: '' });
      fetchData();
    } catch (error) {
      toast.error('Errore');
    }
  };

  const handleDeleteFranchigia = async (id) => {
    if (!window.confirm('Eliminare questa franchigia?')) return;
    try {
      await api.delete(`/franchigie/${id}`, token);
      toast.success('Eliminata');
      fetchData();
    } catch (error) {
      toast.error('Errore');
    }
  };

  // ========== SERVIZI ==========
  const handleAddServizio = async () => {
    try {
      await api.post('/servizi-supplementari', {
        ...newServizio,
        prezzo_unitario: parseFloat(newServizio.prezzo_unitario)
      }, token);
      toast.success('Servizio aggiunto');
      setServizioDialogOpen(false);
      setNewServizio({ nome: '', descrizione: '', prezzo_unitario: '', unita: 'giorno' });
      fetchData();
    } catch (error) {
      toast.error('Errore');
    }
  };

  const handleDeleteServizio = async (id) => {
    if (!window.confirm('Eliminare questo servizio?')) return;
    try {
      await api.delete(`/servizi-supplementari/${id}`, token);
      toast.success('Eliminato');
      fetchData();
    } catch (error) {
      toast.error('Errore');
    }
  };

  // ========== TARIFFE STAGIONALI ==========
  const handleAddTariffa = async () => {
    try {
      await api.post('/settings/tariffe-stagionali', {
        ...newTariffa,
        tariffa_giornaliera: parseFloat(newTariffa.tariffa_giornaliera),
        veicolo_id: newTariffa.veicolo_id === 'tutti' ? null : newTariffa.veicolo_id
      }, token);
      toast.success('Tariffa stagionale aggiunta');
      setTariffaDialogOpen(false);
      setNewTariffa({ nome: '', data_inizio: '', data_fine: '', tariffa_giornaliera: '', descrizione: '', veicolo_id: 'tutti' });
      fetchData();
    } catch (error) {
      toast.error('Errore');
    }
  };

  // Helper per formattare data in italiano (gg/mm/aaaa)
  const formatDateIT = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Helper per trovare il nome veicolo
  const getVeicoloNome = (veicoloId) => {
    if (!veicoloId) return 'Tutti i veicoli';
    const v = veicoli.find(x => x.id === veicoloId);
    return v ? `${v.marca} ${v.modello} (${v.targa})` : 'Veicolo non trovato';
  };

  const handleDeleteTariffa = async (id) => {
    if (!window.confirm('Eliminare questa tariffa?')) return;
    try {
      await api.delete(`/settings/tariffe-stagionali/${id}`, token);
      toast.success('Eliminata');
      fetchData();
    } catch (error) {
      toast.error('Errore');
    }
  };

  // Apri dialog modifica tariffa
  const handleOpenEditTariffa = (tariffa) => {
    setEditTariffa({
      ...tariffa,
      veicolo_id: tariffa.veicolo_id || 'tutti'
    });
    setEditTariffaDialogOpen(true);
  };

  // Salva modifica tariffa
  const handleSaveTariffa = async () => {
    if (!editTariffa) return;
    try {
      await api.put(`/settings/tariffe-stagionali/${editTariffa.id}`, {
        ...editTariffa,
        tariffa_giornaliera: parseFloat(editTariffa.tariffa_giornaliera),
        veicolo_id: editTariffa.veicolo_id === 'tutti' ? null : editTariffa.veicolo_id
      }, token);
      toast.success('Tariffa aggiornata!');
      setEditTariffaDialogOpen(false);
      setEditTariffa(null);
      fetchData();
    } catch (error) {
      toast.error('Errore nell\'aggiornamento');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="impostazioni-page">
      <div>
        <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Impostazioni
        </h2>
        <p className="text-sm text-slate-500">Configura tutti gli aspetti dell'agenzia</p>
      </div>

      <Tabs defaultValue="agenzia" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="agenzia" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Dati Agenzia
          </TabsTrigger>
          <TabsTrigger value="tariffe" className="flex items-center gap-2">
            <Euro className="w-4 h-4" /> Tariffe Stagionali
          </TabsTrigger>
          <TabsTrigger value="condizioni" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Condizioni
          </TabsTrigger>
          <TabsTrigger value="franchigie" className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Franchigie
          </TabsTrigger>
          <TabsTrigger value="servizi" className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Servizi
          </TabsTrigger>
        </TabsList>

        {/* ========== DATI AGENZIA ========== */}
        <TabsContent value="agenzia">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Logo */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Logo Agenzia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {agenzia.logo_url ? (
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-32 border rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                      <img src={agenzia.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleRemoveLogo}>
                      <Trash2 className="w-4 h-4 mr-2" /> Rimuovi
                    </Button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center text-slate-400">
                    Nessun logo
                  </div>
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingLogo ? 'Caricamento...' : 'Cambia logo'}
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">Formati: JPG, PNG, GIF, WEBP. Max 5MB.</p>
                </div>
              </CardContent>
            </Card>

            {/* Dati Agenzia */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Dati Agenzia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Ragione Sociale / Nome Agenzia *</Label>
                  <Input 
                    value={agenzia.ragione_sociale} 
                    onChange={e => setAgenzia({...agenzia, ragione_sociale: e.target.value})}
                    placeholder="Soverato Rental"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slogan</Label>
                  <Input 
                    value={agenzia.slogan || ''} 
                    onChange={e => setAgenzia({...agenzia, slogan: e.target.value})}
                    placeholder="Il noleggio che conviene"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Indirizzo *</Label>
                  <Input 
                    value={agenzia.indirizzo} 
                    onChange={e => setAgenzia({...agenzia, indirizzo: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label>CAP</Label>
                    <Input value={agenzia.cap} onChange={e => setAgenzia({...agenzia, cap: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Comune</Label>
                    <Input value={agenzia.comune} onChange={e => setAgenzia({...agenzia, comune: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prov.</Label>
                    <Input value={agenzia.provincia} onChange={e => setAgenzia({...agenzia, provincia: e.target.value})} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contatti e Fiscale */}
            <Card className="border-slate-200 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Contatti e Dati Fiscali</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Telefono</Label>
                    <Input value={agenzia.telefono} onChange={e => setAgenzia({...agenzia, telefono: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={agenzia.email} onChange={e => setAgenzia({...agenzia, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>P.IVA</Label>
                    <Input value={agenzia.piva} onChange={e => setAgenzia({...agenzia, piva: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Codice Fiscale</Label>
                    <Input value={agenzia.cf} onChange={e => setAgenzia({...agenzia, cf: e.target.value})} />
                  </div>
                </div>
                <Button onClick={handleSaveAgenzia} className="mt-6 bg-blue-600 hover:bg-blue-700" disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Salvataggio...' : 'Salva Dati Agenzia'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========== TARIFFE STAGIONALI ========== */}
        <TabsContent value="tariffe">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Tariffe Stagionali</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Configura i moltiplicatori di prezzo per i diversi periodi dell'anno. 
                  Es: Alta stagione (Luglio-Agosto) = 1.5x, Bassa stagione = 0.8x
                </p>
              </div>
              <Dialog open={tariffaDialogOpen} onOpenChange={setTariffaDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Aggiungi Periodo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuova Tariffa Stagionale</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome Periodo *</Label>
                      <Input 
                        value={newTariffa.nome} 
                        onChange={e => setNewTariffa({...newTariffa, nome: e.target.value})}
                        placeholder="Es: Alta Stagione Estiva"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Car className="w-4 h-4" /> Veicolo *
                      </Label>
                      <Select 
                        value={newTariffa.veicolo_id} 
                        onValueChange={v => setNewTariffa({...newTariffa, veicolo_id: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona veicolo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tutti">🚗 Tutti i veicoli</SelectItem>
                          {veicoli.map(v => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.marca} {v.modello} ({v.targa})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        Seleziona un veicolo specifico o "Tutti i veicoli" per applicare la tariffa all'intero parco auto
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Inizio *</Label>
                        <Input 
                          type="date" 
                          value={newTariffa.data_inizio} 
                          onChange={e => setNewTariffa({...newTariffa, data_inizio: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Fine *</Label>
                        <Input 
                          type="date" 
                          value={newTariffa.data_fine} 
                          onChange={e => setNewTariffa({...newTariffa, data_fine: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Euro className="w-4 h-4" /> Tariffa Giornaliera (€) *
                      </Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={newTariffa.tariffa_giornaliera} 
                        onChange={e => setNewTariffa({...newTariffa, tariffa_giornaliera: e.target.value})}
                        placeholder="Es: 45.00"
                      />
                      <p className="text-xs text-slate-500">
                        Prezzo al giorno per questo periodo stagionale
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrizione</Label>
                      <Textarea 
                        value={newTariffa.descrizione} 
                        onChange={e => setNewTariffa({...newTariffa, descrizione: e.target.value})}
                        rows={2}
                        placeholder="Note sul periodo..."
                      />
                    </div>
                    <Button onClick={handleAddTariffa} className="w-full bg-blue-600 hover:bg-blue-700">
                      Aggiungi Periodo
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {tariffeStagionali.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>Nessun periodo stagionale configurato</p>
                  <p className="text-sm">I prezzi base dei veicoli verranno applicati tutto l'anno</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome Periodo</TableHead>
                      <TableHead>Veicolo</TableHead>
                      <TableHead>Data Inizio</TableHead>
                      <TableHead>Data Fine</TableHead>
                      <TableHead>Tariffa Giornaliera</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tariffeStagionali.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.nome}</TableCell>
                        <TableCell>
                          <span className={`text-sm ${t.veicolo_id ? 'text-blue-600' : 'text-slate-500'}`}>
                            {getVeicoloNome(t.veicolo_id)}
                          </span>
                        </TableCell>
                        <TableCell>{formatDateIT(t.data_inizio)}</TableCell>
                        <TableCell>{formatDateIT(t.data_fine)}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded text-sm font-medium bg-blue-100 text-blue-700">
                            €{(t.tariffa_giornaliera || 0).toFixed(2)}/giorno
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">{t.descrizione}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => handleOpenEditTariffa(t)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteTariffa(t.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Dialog Modifica Tariffa */}
          <Dialog open={editTariffaDialogOpen} onOpenChange={setEditTariffaDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifica Tariffa Stagionale</DialogTitle>
              </DialogHeader>
              {editTariffa && (
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome Periodo *</Label>
                    <Input 
                      value={editTariffa.nome} 
                      onChange={e => setEditTariffa({...editTariffa, nome: e.target.value})}
                      placeholder="Es: Alta Stagione Estate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Car className="w-4 h-4" /> Veicolo
                    </Label>
                    <Select 
                      value={editTariffa.veicolo_id || 'tutti'} 
                      onValueChange={v => setEditTariffa({...editTariffa, veicolo_id: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tutti">Tutti i veicoli</SelectItem>
                        {veicoli.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.marca} {v.modello} ({v.targa})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Inizio *</Label>
                      <Input 
                        type="date" 
                        value={editTariffa.data_inizio} 
                        onChange={e => setEditTariffa({...editTariffa, data_inizio: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Fine *</Label>
                      <Input 
                        type="date" 
                        value={editTariffa.data_fine} 
                        onChange={e => setEditTariffa({...editTariffa, data_fine: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Euro className="w-4 h-4" /> Tariffa Giornaliera (€) *
                    </Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      value={editTariffa.tariffa_giornaliera} 
                      onChange={e => setEditTariffa({...editTariffa, tariffa_giornaliera: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrizione</Label>
                    <Textarea 
                      value={editTariffa.descrizione || ''} 
                      onChange={e => setEditTariffa({...editTariffa, descrizione: e.target.value})}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditTariffaDialogOpen(false)} className="flex-1">
                      Annulla
                    </Button>
                    <Button onClick={handleSaveTariffa} className="flex-1 bg-blue-600 hover:bg-blue-700">
                      <Save className="w-4 h-4 mr-2" /> Salva Modifiche
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ========== CONDIZIONI GENERALI ========== */}
        <TabsContent value="condizioni">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Condizioni Generali di Noleggio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                Queste condizioni verranno inserite nel contratto di noleggio.
              </p>
              <Textarea 
                value={condizioni}
                onChange={(e) => setCondizioni(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                placeholder="Inserisci le condizioni generali..."
              />
              <Button onClick={handleSaveCondizioni} className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Salvataggio...' : 'Salva Condizioni'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== FRANCHIGIE ========== */}
        <TabsContent value="franchigie">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Gestione Franchigie Assicurative</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Configura le franchigie e penalità assicurative. I prezzi sono modificabili cliccando sul valore.
                </p>
              </div>
              <Dialog open={franchigiaDialogOpen} onOpenChange={setFranchigiaDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Aggiungi
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuova Franchigia</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input value={newFranchigia.nome} onChange={e => setNewFranchigia({...newFranchigia, nome: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrizione</Label>
                      <Textarea value={newFranchigia.descrizione} onChange={e => setNewFranchigia({...newFranchigia, descrizione: e.target.value})} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Importo Massimo (€)</Label>
                        <Input type="number" step="0.01" value={newFranchigia.importo_massimo} onChange={e => setNewFranchigia({...newFranchigia, importo_massimo: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Costo Giornaliero (€)</Label>
                        <Input type="number" step="0.01" value={newFranchigia.costo_giornaliero} onChange={e => setNewFranchigia({...newFranchigia, costo_giornaliero: e.target.value})} />
                      </div>
                    </div>
                    <Button onClick={handleAddFranchigia} className="w-full bg-blue-600 hover:bg-blue-700">
                      Aggiungi Franchigia
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {franchigie.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Nessuna franchigia configurata</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>Importo/Penale (€)</TableHead>
                      <TableHead>Costo/giorno (€)</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {franchigie.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nome}</TableCell>
                        <TableCell className="text-sm text-slate-500 max-w-xs">{f.descrizione}</TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="w-24 h-8 text-center"
                            defaultValue={f.importo_massimo || 0}
                            onBlur={async (e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              if (newValue !== f.importo_massimo) {
                                try {
                                  await api.put(`/franchigie/${f.id}`, { importo_massimo: newValue }, token);
                                  toast.success('Valore aggiornato');
                                  fetchData();
                                } catch (err) {
                                  toast.error('Errore aggiornamento');
                                }
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="w-24 h-8 text-center"
                            defaultValue={f.costo_giornaliero || 0}
                            onBlur={async (e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              if (newValue !== f.costo_giornaliero) {
                                try {
                                  await api.put(`/franchigie/${f.id}`, { costo_giornaliero: newValue }, token);
                                  toast.success('Valore aggiornato');
                                  fetchData();
                                } catch (err) {
                                  toast.error('Errore aggiornamento');
                                }
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteFranchigia(f.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== SERVIZI ========== */}
        <TabsContent value="servizi">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Gestione Servizi Supplementari</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Configura i servizi extra offerti. I prezzi sono modificabili cliccando sul valore.
                </p>
              </div>
              <Dialog open={servizioDialogOpen} onOpenChange={setServizioDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Aggiungi
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuovo Servizio</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input value={newServizio.nome} onChange={e => setNewServizio({...newServizio, nome: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrizione</Label>
                      <Textarea value={newServizio.descrizione} onChange={e => setNewServizio({...newServizio, descrizione: e.target.value})} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prezzo Unitario (€) *</Label>
                        <Input type="number" step="0.01" value={newServizio.prezzo_unitario} onChange={e => setNewServizio({...newServizio, prezzo_unitario: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Unità</Label>
                        <Input value={newServizio.unita} onChange={e => setNewServizio({...newServizio, unita: e.target.value})} placeholder="giorno, noleggio, etc." />
                      </div>
                    </div>
                    <Button onClick={handleAddServizio} className="w-full bg-blue-600 hover:bg-blue-700">
                      Aggiungi Servizio
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {servizi.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Nessun servizio configurato</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>Prezzo (€)</TableHead>
                      <TableHead>Unità</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servizi.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Input 
                            defaultValue={s.nome}
                            className="h-8 text-sm font-medium"
                            onBlur={async (e) => {
                              if (e.target.value !== s.nome) {
                                try {
                                  await api.put(`/servizi-supplementari/${s.id}`, { nome: e.target.value }, token);
                                  toast.success('Nome aggiornato');
                                  fetchData();
                                } catch (err) {
                                  toast.error('Errore aggiornamento');
                                }
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            defaultValue={s.descrizione}
                            className="h-8 text-sm text-slate-500"
                            onBlur={async (e) => {
                              if (e.target.value !== s.descrizione) {
                                try {
                                  await api.put(`/servizi-supplementari/${s.id}`, { descrizione: e.target.value }, token);
                                  toast.success('Descrizione aggiornata');
                                  fetchData();
                                } catch (err) {
                                  toast.error('Errore aggiornamento');
                                }
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            step="0.01" 
                            className="w-24 h-8 text-center"
                            defaultValue={s.prezzo_unitario || 0}
                            onBlur={async (e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              if (newValue !== s.prezzo_unitario) {
                                try {
                                  await api.put(`/servizi-supplementari/${s.id}`, { prezzo_unitario: newValue }, token);
                                  toast.success('Prezzo aggiornato');
                                  fetchData();
                                } catch (err) {
                                  toast.error('Errore aggiornamento');
                                }
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            defaultValue={s.unita}
                            className="w-24 h-8 text-sm"
                            onBlur={async (e) => {
                              if (e.target.value !== s.unita) {
                                try {
                                  await api.put(`/servizi-supplementari/${s.id}`, { unita: e.target.value }, token);
                                  toast.success('Unità aggiornata');
                                  fetchData();
                                } catch (err) {
                                  toast.error('Errore aggiornamento');
                                }
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteServizio(s.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
