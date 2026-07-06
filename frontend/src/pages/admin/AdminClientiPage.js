import { useState, useEffect } from 'react';
import { useAuth, api } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Users, Search, Mail, Phone, MapPin, Key, Eye, EyeOff, History, FileText, Edit, Trash2, Plus, UserPlus, CreditCard, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminClientiPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [clienti, setClienti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState({});
  const [editPasswordDialog, setEditPasswordDialog] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  
  // Modifica profilo cliente
  const [editClientDialog, setEditClientDialog] = useState(null);
  const [editClientData, setEditClientData] = useState(null);
  const [savingEditClient, setSavingEditClient] = useState(false);
  
  // Nuovo cliente
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);
  const [nuovoCliente, setNuovoCliente] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    cellulare: '',
    data_nascita: '',
    luogo_nascita: '',
    codice_fiscale: '',
    indirizzo: '',
    comune: '',
    provincia: '',
    cap: '',
    stato: 'Italia',
    patente: {
      numero: '',
      categoria: 'B',
      rilasciata_da: '',
      data_rilascio: '',
      data_scadenza: '',
      paese: ''
    },
    // Documento d'identità (immagini base64)
    documento_identita: {
      tipo: 'Carta d\'identità',
      numero: '',
      immagine_fronte: '',
      immagine_retro: ''
    },
    // Carta di credito (opzionale)
    carta_credito: {
      circuito: '',
      intestatario: '',
      numero: '',
      scadenza_mese: '',
      scadenza_anno: ''
    }
  });

  const fetchClienti = async () => {
    try {
      const data = await api.get('/clienti', token);
      setClienti(data);
    } catch (error) {
      toast.error('Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClienti();
  }, [token]);

  // Helper per verificare stato patente
  const getPatentStatus = (cliente) => {
    const scadenza = cliente.patente?.data_scadenza || cliente.patente_data_scadenza;
    if (!scadenza) return { status: 'unknown', message: 'Scadenza non inserita' };
    
    const oggi = new Date();
    const dataScadenza = new Date(scadenza);
    const diffDays = Math.ceil((dataScadenza - oggi) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { status: 'expired', message: `Scaduta da ${Math.abs(diffDays)} giorni`, color: 'text-red-600 bg-red-50' };
    } else if (diffDays <= 30) {
      return { status: 'expiring', message: `Scade tra ${diffDays} giorni`, color: 'text-orange-600 bg-orange-50' };
    } else if (diffDays <= 90) {
      return { status: 'warning', message: `Scade tra ${diffDays} giorni`, color: 'text-yellow-600 bg-yellow-50' };
    }
    return { status: 'valid', message: 'Valida', color: 'text-green-600 bg-green-50' };
  };

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('La password deve essere di almeno 6 caratteri');
      return;
    }
    try {
      await api.put(`/clienti/${editPasswordDialog.id}`, { password_chiaro: newPassword }, token);
      toast.success('Password impostata con successo');
      setEditPasswordDialog(null);
      setNewPassword('');
      fetchClienti();
    } catch (error) {
      toast.error('Errore nel salvataggio');
    }
  };

  const openEditClientDialog = (cliente) => {
    setEditClientData({ ...cliente, patente: { ...(cliente.patente || {}) }, carta_credito: { ...(cliente.carta_credito || {}) } });
    setEditClientDialog(cliente);
  };

  const handleSaveEditClient = async () => {
    if (!editClientData) return;
    setSavingEditClient(true);
    try {
      const payload = {
        nome: editClientData.nome,
        cognome: editClientData.cognome,
        data_nascita: editClientData.data_nascita,
        luogo_nascita: editClientData.luogo_nascita,
        codice_fiscale: editClientData.codice_fiscale,
        indirizzo: editClientData.indirizzo,
        comune: editClientData.comune,
        provincia: editClientData.provincia,
        cap: editClientData.cap,
        stato: editClientData.stato,
        cellulare: editClientData.cellulare,
        patente: editClientData.patente,
        carta_credito: editClientData.carta_credito
      };
      await api.put(`/clienti/${editClientData.id}`, payload, token);
      toast.success('Profilo cliente aggiornato!');
      setEditClientDialog(null);
      setEditClientData(null);
      fetchClienti();
    } catch (error) {
      toast.error('Errore nel salvataggio');
    } finally {
      setSavingEditClient(false);
    }
  };

  const handleDeleteCliente = async (cliente) => {
    const conferma = window.confirm(
      `Sei sicuro di voler eliminare il cliente ${cliente.nome} ${cliente.cognome}?\n\n` +
      `⚠️ Questa azione:\n` +
      `• ELIMINERÀ tutte le prenotazioni FUTURE del cliente\n` +
      `• ELIMINERÀ tutti i contratti FUTURI del cliente\n` +
      `• Manterrà lo storico delle prenotazioni passate\n` +
      `• Impedirà al cliente di effettuare il login`
    );
    
    if (!conferma) return;
    
    try {
      const result = await api.delete(`/clienti/${cliente.id}`, token);
      toast.success(`Cliente eliminato. ${result.prenotazioni_eliminate} prenotazioni e ${result.contratti_eliminati} contratti futuri eliminati.`);
      fetchClienti();
    } catch (error) {
      toast.error('Errore nell\'eliminazione');
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

  // Reset form nuovo cliente
  const resetNuovoCliente = () => {
    setNuovoCliente({
      nome: '',
      cognome: '',
      email: '',
      password: '',
      cellulare: '',
      data_nascita: '',
      luogo_nascita: '',
      codice_fiscale: '',
      indirizzo: '',
      comune: '',
      provincia: '',
      cap: '',
      stato: 'Italia',
      patente: {
        numero: '',
        categoria: 'B',
        rilasciata_da: '',
        data_rilascio: '',
        data_scadenza: ''
      },
      carta_credito: {
        circuito: '',
        intestatario: '',
        numero: '',
        scadenza_mese: '',
        scadenza_anno: ''
      }
    });
  };

  // Crea nuovo cliente
  const handleCreateCliente = async () => {
    // Validazione base
    if (!nuovoCliente.nome || !nuovoCliente.cognome || !nuovoCliente.email || !nuovoCliente.password) {
      toast.error('Compila almeno: Nome, Cognome, Email e Password');
      return;
    }
    if (nuovoCliente.password.length < 6) {
      toast.error('La password deve essere di almeno 6 caratteri');
      return;
    }
    
    setSavingCliente(true);
    try {
      await api.post('/clienti/admin-create', nuovoCliente, token);
      toast.success('Cliente creato con successo!');
      setCreateDialogOpen(false);
      resetNuovoCliente();
      fetchClienti();
    } catch (error) {
      toast.error(error.message || 'Errore nella creazione');
    } finally {
      setSavingCliente(false);
    }
  };

  const filtered = clienti
    .filter(c => 
      `${c.nome} ${c.cognome} ${c.email} ${c.codice_fiscale} ${c.cellulare}`.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => 
      (a.cognome || '').localeCompare(b.cognome || '', 'it', { sensitivity: 'base' }) ||
      (a.nome || '').localeCompare(b.nome || '', 'it', { sensitivity: 'base' })
    );

  return (
    <div className="space-y-6" data-testid="clienti-page">
      <div>
        <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Gestione Clienti
        </h2>
        <p className="text-sm text-slate-500">Visualizza tutti i clienti registrati</p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Cerca per nome, email, CF o telefono..." 
                className="pl-10" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus className="w-4 h-4 mr-2" /> Crea Cliente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessun cliente trovato</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cognome / Nome</TableHead>
                    <TableHead>Credenziali Accesso</TableHead>
                    <TableHead>Codice Fiscale</TableHead>
                    <TableHead>Residenza</TableHead>
                    <TableHead>Patente</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium"><strong>{c.cognome}</strong> {c.nome}</p>
                          <p className="text-xs text-slate-500">Nato/a: {formatDateIT(c.data_nascita)} a {c.luogo_nascita}</p>
                          <p className="text-xs text-slate-500 mt-1"><Phone className="w-3 h-3 inline mr-1" />{c.cellulare}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3 text-slate-400" /> 
                            <span className="font-medium">{c.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Key className="w-3 h-3 text-slate-400" />
                            <span className="font-mono text-sm bg-yellow-100 px-2 py-0.5 rounded">
                              {showPasswords[c.id] ? (c.password_chiaro || 'Non disponibile') : '••••••••'}
                            </span>
                            <button
                              onClick={() => setShowPasswords(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title={showPasswords[c.id] ? "Nascondi password" : "Mostra password"}
                            >
                              {showPasswords[c.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => { setEditPasswordDialog(c); setNewPassword(c.password_chiaro || ''); }}
                              className="text-orange-600 hover:text-orange-800 p-1"
                              title="Modifica password"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{c.codice_fiscale}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{c.indirizzo}</p>
                          <p className="text-slate-500">{c.cap} {c.comune} ({c.provincia})</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{c.patente?.numero || c.patente_numero}</p>
                          <p className="text-slate-500">Cat: {c.patente?.categoria || c.patente_categoria || 'B'} • Scad: {formatDateIT(c.patente?.data_scadenza || c.patente_data_scadenza)}</p>
                          {/* Alert patente scaduta/in scadenza */}
                          {(() => {
                            const patentStatus = getPatentStatus(c);
                            if (patentStatus.status === 'expired' || patentStatus.status === 'expiring') {
                              return (
                                <div className={`mt-1 px-2 py-1 rounded text-xs flex items-center gap-1 ${patentStatus.color}`}>
                                  <AlertTriangle className="w-3 h-3" />
                                  {patentStatus.message}
                                </div>
                              );
                            } else if (patentStatus.status === 'warning') {
                              return (
                                <div className={`mt-1 px-2 py-1 rounded text-xs flex items-center gap-1 ${patentStatus.color}`}>
                                  <AlertTriangle className="w-3 h-3" />
                                  {patentStatus.message}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="space-x-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openEditClientDialog(c)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="w-4 h-4 mr-1" /> Profilo
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/admin/clienti/${c.id}/storico`)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <History className="w-4 h-4 mr-1" /> Storico
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteCliente(c)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Modifica Password */}
      <Dialog open={!!editPasswordDialog} onOpenChange={() => { setEditPasswordDialog(null); setNewPassword(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica Password Cliente</DialogTitle>
          </DialogHeader>
          {editPasswordDialog && (
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">
                  Cliente: <strong>{editPasswordDialog.nome} {editPasswordDialog.cognome}</strong>
                </p>
                <p className="text-sm text-slate-500">
                  Email: {editPasswordDialog.email}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nuova Password (visibile in chiaro)</Label>
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Inserisci la nuova password..."
                  className="font-mono"
                />
                <p className="text-xs text-slate-500">La password sarà visibile nella lista clienti</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setEditPasswordDialog(null); setNewPassword(''); }}>
                  Annulla
                </Button>
                <Button onClick={handleSetPassword} className="bg-blue-600 hover:bg-blue-700">
                  Salva Password
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Crea Nuovo Cliente */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetNuovoCliente(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Crea Nuovo Cliente
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Dati di Accesso */}
            <div className="space-y-3">
              <h3 className="font-semibold text-blue-700 border-b pb-1">Credenziali di Accesso</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={nuovoCliente.email}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, email: e.target.value})}
                    placeholder="cliente@email.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Password *</Label>
                  <Input 
                    type="text"
                    value={nuovoCliente.password}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, password: e.target.value})}
                    placeholder="Minimo 6 caratteri"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Dati Anagrafici */}
            <div className="space-y-3">
              <h3 className="font-semibold text-blue-700 border-b pb-1">Dati Anagrafici</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input 
                    value={nuovoCliente.nome}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, nome: e.target.value})}
                    placeholder="Mario"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cognome *</Label>
                  <Input 
                    value={nuovoCliente.cognome}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, cognome: e.target.value})}
                    placeholder="Rossi"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Data di Nascita</Label>
                  <Input 
                    type="date"
                    value={nuovoCliente.data_nascita}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, data_nascita: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Luogo di Nascita</Label>
                  <Input 
                    value={nuovoCliente.luogo_nascita}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, luogo_nascita: e.target.value})}
                    placeholder="Roma"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Codice Fiscale</Label>
                  <Input 
                    value={nuovoCliente.codice_fiscale}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, codice_fiscale: e.target.value.toUpperCase()})}
                    placeholder="RSSMRA85M01H501Z"
                    className="uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cellulare</Label>
                  <Input 
                    value={nuovoCliente.cellulare}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, cellulare: e.target.value})}
                    placeholder="+39 333 1234567"
                  />
                </div>
              </div>
            </div>

            {/* Residenza */}
            <div className="space-y-3">
              <h3 className="font-semibold text-blue-700 border-b pb-1">Residenza</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Indirizzo</Label>
                  <Input 
                    value={nuovoCliente.indirizzo}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, indirizzo: e.target.value})}
                    placeholder="Via Roma, 123"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Comune</Label>
                  <Input 
                    value={nuovoCliente.comune}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, comune: e.target.value})}
                    placeholder="Roma"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Provincia</Label>
                  <Input 
                    value={nuovoCliente.provincia}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, provincia: e.target.value.toUpperCase()})}
                    placeholder="RM"
                    maxLength={2}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label>CAP / ZIP</Label>
                  <Input 
                    value={nuovoCliente.cap}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, cap: e.target.value})}
                    placeholder="00100 / SW1A 1AA / 75001"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Stato</Label>
                  <Input 
                    value={nuovoCliente.stato}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, stato: e.target.value})}
                    placeholder="Italia"
                  />
                </div>
              </div>
            </div>

            {/* Patente */}
            <div className="space-y-3">
              <h3 className="font-semibold text-blue-700 border-b pb-1">Patente di Guida</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Numero Patente</Label>
                  <Input 
                    value={nuovoCliente.patente.numero}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, patente: {...nuovoCliente.patente, numero: e.target.value}})}
                    placeholder="AB1234567X / DVLA-XXX-YYY / ecc."
                    maxLength={30}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Input 
                    value={nuovoCliente.patente.categoria}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, patente: {...nuovoCliente.patente, categoria: e.target.value.toUpperCase()}})}
                    placeholder="B, A, C, D, US Class C..."
                    className="uppercase"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Rilasciata da</Label>
                  <Input 
                    value={nuovoCliente.patente.rilasciata_da}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, patente: {...nuovoCliente.patente, rilasciata_da: e.target.value}})}
                    placeholder="MCTC Roma / DVLA UK / DMV California..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Paese di rilascio</Label>
                  <Input 
                    value={nuovoCliente.patente.paese || ''}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, patente: {...nuovoCliente.patente, paese: e.target.value}})}
                    placeholder="Italia / UK / USA / Francia..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Data Rilascio</Label>
                  <Input 
                    type="date"
                    value={nuovoCliente.patente.data_rilascio}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, patente: {...nuovoCliente.patente, data_rilascio: e.target.value}})}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Data Scadenza</Label>
                  <Input 
                    type="date"
                    value={nuovoCliente.patente.data_scadenza}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, patente: {...nuovoCliente.patente, data_scadenza: e.target.value}})}
                  />
                </div>
              </div>
            </div>

            {/* Documento d'Identità (con upload/scanner) */}
            <div className="space-y-3">
              <h3 className="font-semibold text-blue-700 border-b pb-1 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Documento d'Identità
                <span className="text-xs font-normal text-slate-500">(carica o scansiona)</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo documento</Label>
                  <Select 
                    value={nuovoCliente.documento_identita?.tipo || "Carta d'identità"}
                    onValueChange={(v) => setNuovoCliente({...nuovoCliente, documento_identita: {...nuovoCliente.documento_identita, tipo: v}})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Carta d'identità">Carta d'identità</SelectItem>
                      <SelectItem value="Patente">Patente</SelectItem>
                      <SelectItem value="Passaporto">Passaporto</SelectItem>
                      <SelectItem value="Altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Numero documento</Label>
                  <Input 
                    value={nuovoCliente.documento_identita?.numero || ''}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, documento_identita: {...nuovoCliente.documento_identita, numero: e.target.value}})}
                    placeholder="AB1234567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {['fronte', 'retro'].map(lato => {
                  const key = `immagine_${lato}`;
                  const img = nuovoCliente.documento_identita?.[key];
                  const inputId = `doc-${lato}-input`;
                  const handleFile = (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error(`Immagine troppo grande (max 5MB). Dimensione: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setNuovoCliente(prev => ({
                        ...prev, 
                        documento_identita: {...prev.documento_identita, [key]: ev.target.result}
                      }));
                    };
                    reader.readAsDataURL(file);
                  };
                  return (
                    <div key={lato} className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <Label className="capitalize font-semibold">Lato {lato}</Label>
                      {img ? (
                        <div className="relative">
                          <img src={img} alt={`Documento ${lato}`} className="w-full h-32 object-contain bg-white border border-slate-200 rounded" />
                          <button 
                            type="button"
                            onClick={() => setNuovoCliente(prev => ({...prev, documento_identita: {...prev.documento_identita, [key]: ''}}))}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                            data-testid={`remove-doc-${lato}`}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="h-32 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 text-xs">
                          <FileText className="w-8 h-8 mb-1" />
                          <span>Nessuna immagine</span>
                        </div>
                      )}
                      <input id={inputId} type="file" accept="image/*" onChange={handleFile} className="hidden" data-testid={`upload-doc-${lato}`} />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => document.getElementById(inputId).click()}>
                          Carica file
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-blue-700 border-b pb-1 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Carta di Credito 
                <span className="text-xs font-normal text-slate-500">(opzionale - per garanzia)</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Circuito</Label>
                  <Select 
                    value={nuovoCliente.carta_credito.circuito || "none"} 
                    onValueChange={(v) => setNuovoCliente({...nuovoCliente, carta_credito: {...nuovoCliente.carta_credito, circuito: v === "none" ? "" : v}})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona circuito" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      <SelectItem value="Visa">Visa</SelectItem>
                      <SelectItem value="Mastercard">Mastercard</SelectItem>
                      <SelectItem value="American Express">American Express</SelectItem>
                      <SelectItem value="Bancomat">Bancomat/PagoBancomat</SelectItem>
                      <SelectItem value="Postepay">Postepay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Intestatario</Label>
                  <Input 
                    value={nuovoCliente.carta_credito.intestatario}
                    onChange={(e) => setNuovoCliente({...nuovoCliente, carta_credito: {...nuovoCliente.carta_credito, intestatario: e.target.value.toUpperCase()}})}
                    placeholder="MARIO ROSSI"
                    className="uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Numero Carta</Label>
                  <Input 
                    value={nuovoCliente.carta_credito.numero}
                    onChange={(e) => {
                      // Format: only numbers, max 19 chars
                      const val = e.target.value.replace(/\D/g, '').substring(0, 19);
                      setNuovoCliente({...nuovoCliente, carta_credito: {...nuovoCliente.carta_credito, numero: val}});
                    }}
                    placeholder="1234 5678 9012 3456"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Scadenza</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={nuovoCliente.carta_credito.scadenza_mese} 
                      onValueChange={(v) => setNuovoCliente({...nuovoCliente, carta_credito: {...nuovoCliente.carta_credito, scadenza_mese: v}})}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 12}, (_, i) => String(i+1).padStart(2, '0')).map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="self-center">/</span>
                    <Select 
                      value={nuovoCliente.carta_credito.scadenza_anno} 
                      onValueChange={(v) => setNuovoCliente({...nuovoCliente, carta_credito: {...nuovoCliente.carta_credito, scadenza_anno: v}})}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="AAAA" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 15}, (_, i) => String(new Date().getFullYear() + i)).map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Pulsanti */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => { setCreateDialogOpen(false); resetNuovoCliente(); }}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button 
                onClick={handleCreateCliente}
                disabled={savingCliente}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {savingCliente ? 'Creazione...' : 'Crea Cliente'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Modifica Profilo Cliente */}
      <Dialog open={!!editClientDialog} onOpenChange={() => { setEditClientDialog(null); setEditClientData(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Modifica Profilo: {editClientData?.nome} {editClientData?.cognome}
            </DialogTitle>
          </DialogHeader>
          {editClientData && (
            <div className="space-y-4 mt-2">
              {/* Dati Anagrafici */}
              <div className="font-semibold text-sm text-slate-700 border-b pb-1">Dati Anagrafici</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={editClientData.nome || ''} onChange={e => setEditClientData({...editClientData, nome: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Cognome</Label>
                  <Input value={editClientData.cognome || ''} onChange={e => setEditClientData({...editClientData, cognome: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data Nascita</Label>
                  <Input type="date" value={editClientData.data_nascita || ''} onChange={e => setEditClientData({...editClientData, data_nascita: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Luogo Nascita</Label>
                  <Input value={editClientData.luogo_nascita || ''} onChange={e => setEditClientData({...editClientData, luogo_nascita: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Codice Fiscale</Label>
                <Input value={editClientData.codice_fiscale || ''} onChange={e => setEditClientData({...editClientData, codice_fiscale: e.target.value.toUpperCase()})} maxLength={16} />
              </div>
              <div className="space-y-1">
                <Label>Cellulare</Label>
                <Input value={editClientData.cellulare || ''} onChange={e => setEditClientData({...editClientData, cellulare: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Indirizzo</Label>
                <Input value={editClientData.indirizzo || ''} onChange={e => setEditClientData({...editClientData, indirizzo: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Comune</Label>
                  <Input value={editClientData.comune || ''} onChange={e => setEditClientData({...editClientData, comune: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Provincia</Label>
                  <Input value={editClientData.provincia || ''} onChange={e => setEditClientData({...editClientData, provincia: e.target.value.toUpperCase()})} maxLength={2} />
                </div>
                <div className="space-y-1">
                  <Label>CAP</Label>
                  <Input value={editClientData.cap || ''} onChange={e => setEditClientData({...editClientData, cap: e.target.value})} maxLength={10} placeholder="CAP / ZIP" />
                </div>
              </div>

              {/* Patente */}
              <div className="font-semibold text-sm text-slate-700 border-b pb-1 mt-2">Patente di Guida</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Numero Patente</Label>
                  <Input value={editClientData.patente?.numero || ''} onChange={e => setEditClientData({...editClientData, patente: {...editClientData.patente, numero: e.target.value.toUpperCase()}})} />
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Input value={editClientData.patente?.categoria || ''} onChange={e => setEditClientData({...editClientData, patente: {...editClientData.patente, categoria: e.target.value.toUpperCase()}})} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Rilasciata da</Label>
                <Input value={editClientData.patente?.rilasciata_da || ''} onChange={e => setEditClientData({...editClientData, patente: {...editClientData.patente, rilasciata_da: e.target.value}})} placeholder="MCTC / DVLA / DMV..." />
              </div>
              <div className="space-y-1">
                <Label>Paese di rilascio</Label>
                <Input value={editClientData.patente?.paese || ''} onChange={e => setEditClientData({...editClientData, patente: {...editClientData.patente, paese: e.target.value}})} placeholder="Italia / UK / USA / ..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data Rilascio</Label>
                  <Input type="date" value={editClientData.patente?.data_rilascio || ''} onChange={e => setEditClientData({...editClientData, patente: {...editClientData.patente, data_rilascio: e.target.value}})} />
                </div>
                <div className="space-y-1">
                  <Label>Data Scadenza</Label>
                  <Input type="date" value={editClientData.patente?.data_scadenza || ''} onChange={e => setEditClientData({...editClientData, patente: {...editClientData.patente, data_scadenza: e.target.value}})} />
                </div>
              </div>

              {/* Carta di Credito */}
              <div className="font-semibold text-sm text-slate-700 border-b pb-1 mt-2">Carta di Credito</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Circuito</Label>
                  <Select value={editClientData.carta_credito?.circuito || 'none'} onValueChange={v => setEditClientData({...editClientData, carta_credito: {...editClientData.carta_credito, circuito: v === 'none' ? '' : v}})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      <SelectItem value="Visa">Visa</SelectItem>
                      <SelectItem value="Mastercard">Mastercard</SelectItem>
                      <SelectItem value="American Express">American Express</SelectItem>
                      <SelectItem value="Altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Intestatario</Label>
                  <Input value={editClientData.carta_credito?.intestatario || ''} onChange={e => setEditClientData({...editClientData, carta_credito: {...editClientData.carta_credito, intestatario: e.target.value}})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Ultime 4 cifre</Label>
                  <Input value={editClientData.carta_credito?.numero || ''} onChange={e => setEditClientData({...editClientData, carta_credito: {...editClientData.carta_credito, numero: e.target.value.replace(/\D/g,'').slice(0,4)}})} maxLength={4} />
                </div>
                <div className="space-y-1">
                  <Label>Mese Scad.</Label>
                  <Input value={editClientData.carta_credito?.scadenza_mese || ''} onChange={e => setEditClientData({...editClientData, carta_credito: {...editClientData.carta_credito, scadenza_mese: e.target.value}})} maxLength={2} placeholder="MM" />
                </div>
                <div className="space-y-1">
                  <Label>Anno Scad.</Label>
                  <Input value={editClientData.carta_credito?.scadenza_anno || ''} onChange={e => setEditClientData({...editClientData, carta_credito: {...editClientData.carta_credito, scadenza_anno: e.target.value}})} maxLength={2} placeholder="AA" />
                </div>
              </div>

              {/* Bottoni */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="outline" onClick={() => { setEditClientDialog(null); setEditClientData(null); }}>
                  Annulla
                </Button>
                <Button onClick={handleSaveEditClient} disabled={savingEditClient} className="bg-blue-600 hover:bg-blue-700">
                  {savingEditClient ? 'Salvataggio...' : 'Salva Modifiche'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
