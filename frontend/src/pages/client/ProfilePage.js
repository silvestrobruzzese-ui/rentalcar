import { useState, useEffect } from 'react';
import { useAuth, api } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { User, Mail, Phone, MapPin, CreditCard, Save, IdCard, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const PROVINCES = ['AG','AL','AN','AO','AR','AP','AT','AV','BA','BT','BL','BN','BG','BI','BO','BZ','BS','BR','CA','CL','CB','CI','CE','CT','CZ','CH','CO','CS','CR','KR','CN','EN','FM','FE','FI','FG','FC','FR','GE','GO','GR','IM','IS','SP','AQ','LT','LE','LC','LI','LO','LU','MC','MN','MS','MT','ME','MI','MO','MB','NA','NO','NU','OG','OT','OR','PD','PA','PR','PV','PG','PU','PE','PC','PI','PT','PN','PZ','PO','RG','RA','RC','RE','RI','RN','RM','RO','SA','VS','SS','SV','SI','SR','SO','TA','TE','TR','TO','TP','TN','TV','TS','UD','VA','VE','VB','VC','VR','VV','VI','VT'];
const LICENSE_CATEGORIES = ['AM','A1','A2','A','B','B1','BE','C','C1','CE','D','D1','DE'];

export default function ProfilePage() {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get('/auth/me', token);
        setProfile(data);
      } catch (e) {
        toast.error('Errore caricamento profilo');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const updatePatenteField = (field, value) => {
    setProfile(prev => ({
      ...prev,
      patente: { ...(prev.patente || {}), [field]: value }
    }));
  };

  const updateCartaField = (field, value) => {
    setProfile(prev => ({
      ...prev,
      carta_credito: { ...(prev.carta_credito || {}), [field]: value }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nome: profile.nome,
        cognome: profile.cognome,
        data_nascita: profile.data_nascita,
        luogo_nascita: profile.luogo_nascita,
        codice_fiscale: profile.codice_fiscale,
        indirizzo: profile.indirizzo,
        comune: profile.comune,
        provincia: profile.provincia,
        cap: profile.cap,
        stato: profile.stato,
        cellulare: profile.cellulare,
        patente: profile.patente,
        carta_credito: profile.carta_credito
      };
      const updated = await api.put('/auth/profile', payload, token);
      setProfile(updated);
      toast.success('Profilo salvato con successo!');
    } catch (e) {
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pat = profile.patente || {};
  const carta = profile.carta_credito || {};

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="profile-page">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Il mio Profilo
        </h2>
        <p className="text-slate-500">Modifica le tue informazioni personali e salva</p>
      </div>

      <form onSubmit={handleSave}>
        {/* DATI ANAGRAFICI */}
        <Card className="border-slate-200 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Dati Anagrafici
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input data-testid="profile-nome" value={profile.nome || ''} onChange={e => updateField('nome', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cognome *</Label>
                <Input data-testid="profile-cognome" value={profile.cognome || ''} onChange={e => updateField('cognome', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data di Nascita</Label>
                <Input type="date" data-testid="profile-data-nascita" value={profile.data_nascita || ''} onChange={e => updateField('data_nascita', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Luogo di Nascita</Label>
                <Input data-testid="profile-luogo-nascita" value={profile.luogo_nascita || ''} onChange={e => updateField('luogo_nascita', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Codice Fiscale</Label>
              <Input data-testid="profile-cf" value={profile.codice_fiscale || ''} onChange={e => updateField('codice_fiscale', e.target.value.toUpperCase())} maxLength={16} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={profile.email || ''} disabled className="pl-10 bg-slate-50" />
              </div>
              <p className="text-xs text-slate-400">L'email non puo' essere modificata</p>
            </div>
            <div className="space-y-1">
              <Label>Cellulare</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input data-testid="profile-cellulare" value={profile.cellulare || ''} onChange={e => updateField('cellulare', e.target.value)} className="pl-10" placeholder="+39 333 1234567" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Indirizzo</Label>
              <Input data-testid="profile-indirizzo" value={profile.indirizzo || ''} onChange={e => updateField('indirizzo', e.target.value)} placeholder="Via Roma 123" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Comune</Label>
                <Input data-testid="profile-comune" value={profile.comune || ''} onChange={e => updateField('comune', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Provincia</Label>
                <Select value={profile.provincia || ''} onValueChange={v => updateField('provincia', v)}>
                  <SelectTrigger data-testid="profile-provincia"><SelectValue placeholder="Prov." /></SelectTrigger>
                  <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CAP</Label>
                <Input data-testid="profile-cap" value={profile.cap || ''} onChange={e => updateField('cap', e.target.value)} maxLength={10} placeholder="CAP / ZIP" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PATENTE */}
        <Card className="border-slate-200 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IdCard className="w-4 h-4 text-blue-600" /> Patente di Guida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Numero Patente *</Label>
                <Input data-testid="profile-patente-numero" value={pat.numero || ''} onChange={e => updatePatenteField('numero', e.target.value)} maxLength={30} placeholder="AB1234567X / DVLA-XXX / ecc." />
              </div>
              <div className="space-y-1">
                <Label>Categoria *</Label>
                <Input data-testid="profile-patente-categoria" value={pat.categoria || ''} onChange={e => updatePatenteField('categoria', e.target.value.toUpperCase())} placeholder="B, A, US Class C..." maxLength={20} className="uppercase" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Rilasciata da</Label>
              <Input data-testid="profile-patente-rilasciata" value={pat.rilasciata_da || ''} onChange={e => updatePatenteField('rilasciata_da', e.target.value)} placeholder="MCTC / DVLA / DMV..." />
            </div>
            <div className="space-y-1">
              <Label>Paese di rilascio</Label>
              <Input data-testid="profile-patente-paese" value={pat.paese || ''} onChange={e => updatePatenteField('paese', e.target.value)} placeholder="Italia / UK / USA / ..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data Rilascio</Label>
                <Input type="date" data-testid="profile-patente-rilascio" value={pat.data_rilascio || ''} onChange={e => updatePatenteField('data_rilascio', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Data Scadenza *</Label>
                <Input type="date" data-testid="profile-patente-scadenza" value={pat.data_scadenza || ''} onChange={e => updatePatenteField('data_scadenza', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARTA DI CREDITO */}
        <Card className="border-slate-200 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" /> Carta di Credito
              <span className="text-xs font-normal text-slate-400">(Opzionale)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Circuito</Label>
                <Select value={carta.circuito || 'none'} onValueChange={v => updateCartaField('circuito', v === 'none' ? '' : v)}>
                  <SelectTrigger data-testid="profile-carta-circuito"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
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
                <Input data-testid="profile-carta-intestatario" value={carta.intestatario || ''} onChange={e => updateCartaField('intestatario', e.target.value)} placeholder="Nome sulla carta" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ultime 4 cifre</Label>
                <Input data-testid="profile-carta-numero" value={carta.numero || ''} onChange={e => updateCartaField('numero', e.target.value.replace(/\D/g, '').slice(0,4))} maxLength={4} placeholder="1234" />
              </div>
              <div className="space-y-1">
                <Label>Scadenza</Label>
                <div className="flex items-center gap-2">
                  <Input data-testid="profile-carta-mese" value={carta.scadenza_mese || ''} onChange={e => updateCartaField('scadenza_mese', e.target.value)} maxLength={2} placeholder="MM" className="w-16" />
                  <span>/</span>
                  <Input data-testid="profile-carta-anno" value={carta.scadenza_anno || ''} onChange={e => updateCartaField('scadenza_anno', e.target.value)} maxLength={2} placeholder="AA" className="w-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SALVA */}
        <Button 
          type="submit" 
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-semibold"
          disabled={saving}
          data-testid="save-profile-btn"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Salvataggio...
            </span>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Salva Modifiche
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
