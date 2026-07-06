import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const formatDateIT = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) { const [y,m,d] = dateStr.substring(0,10).split('-'); return `${d}/${m}/${y}`; }
  return dateStr;
};
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { 
  Car, User, CreditCard, FileCheck, ChevronRight, ChevronLeft, AlertCircle, CheckCircle, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Dati Anagrafici', icon: User },
  { id: 2, title: 'Patente di Guida', icon: CreditCard },
  { id: 3, title: 'Consensi e Conferma', icon: FileCheck }
];

const PROVINCES = [
  'AG', 'AL', 'AN', 'AO', 'AR', 'AP', 'AT', 'AV', 'BA', 'BT', 'BL', 'BN', 'BG', 'BI', 'BO', 'BZ', 'BS', 'BR',
  'CA', 'CL', 'CB', 'CI', 'CE', 'CT', 'CZ', 'CH', 'CO', 'CS', 'CR', 'KR', 'CN', 'EN', 'FM', 'FE', 'FI', 'FG',
  'FC', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'SP', 'AQ', 'LT', 'LE', 'LC', 'LI', 'LO', 'LU', 'MC', 'MN', 'MS',
  'MT', 'ME', 'MI', 'MO', 'MB', 'NA', 'NO', 'NU', 'OG', 'OT', 'OR', 'PD', 'PA', 'PR', 'PV', 'PG', 'PU', 'PE',
  'PC', 'PI', 'PT', 'PN', 'PZ', 'PO', 'RG', 'RA', 'RC', 'RE', 'RI', 'RN', 'RM', 'RO', 'SA', 'VS', 'SS', 'SV',
  'SI', 'SR', 'SO', 'TA', 'TE', 'TR', 'TO', 'TP', 'TN', 'TV', 'TS', 'UD', 'VA', 'VE', 'VB', 'VC', 'VR', 'VV', 'VI', 'VT'
];

const LICENSE_CATEGORIES = ['AM', 'A1', 'A2', 'A', 'B', 'B1', 'BE', 'C', 'C1', 'CE', 'D', 'D1', 'DE'];

export default function RegistrationPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // Anagrafica
    nome: '',
    cognome: '',
    data_nascita: '',
    luogo_nascita: '',
    codice_fiscale: '',
    indirizzo: '',
    comune: '',
    provincia: '',
    cap: '',
    stato: 'Italia',
    cellulare: '',
    email: '',
    password: '',
    conferma_password: '',
    // Patente
    patente_intestatario_nome: '',
    patente_intestatario_cognome: '',
    patente_numero: '',
    patente_categoria: '',
    patente_data_rilascio: '',
    patente_data_scadenza: '',
    patente_paese_rilascio: 'Italia',
    // Consensi
    accetta_condizioni: false,
    accetta_privacy: false,
    conferma_veridicita: false
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
  };

  const validateStep1 = () => {
    const errs = [];
    if (!formData.nome.trim()) errs.push('Nome è obbligatorio');
    if (!formData.cognome.trim()) errs.push('Cognome è obbligatorio');
    if (!formData.data_nascita) errs.push('Data di nascita è obbligatoria');
    if (!formData.luogo_nascita.trim()) errs.push('Luogo di nascita è obbligatorio');
    if (!formData.codice_fiscale.trim()) errs.push('Codice fiscale è obbligatorio');
    if (formData.codice_fiscale.trim().length !== 16) errs.push('Codice fiscale deve essere di 16 caratteri');
    if (!formData.indirizzo.trim()) errs.push('Indirizzo è obbligatorio');
    if (!formData.comune.trim()) errs.push('Comune è obbligatorio');
    if (!formData.provincia) errs.push('Provincia è obbligatoria');
    if (!formData.cap.trim()) errs.push('CAP è obbligatorio');
    if (!formData.cellulare.trim()) errs.push('Cellulare è obbligatorio');
    if (!formData.email.trim()) errs.push('Email è obbligatoria');
    if (!formData.password) errs.push('Password è obbligatoria');
    if (formData.password.length < 6) errs.push('Password deve essere di almeno 6 caratteri');
    if (formData.password !== formData.conferma_password) errs.push('Le password non corrispondono');
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) errs.push('Email non valida');
    
    return errs;
  };

  const validateStep2 = () => {
    const errs = [];
    if (!formData.patente_intestatario_nome.trim()) errs.push('Nome intestatario patente è obbligatorio');
    if (!formData.patente_intestatario_cognome.trim()) errs.push('Cognome intestatario patente è obbligatorio');
    if (!formData.patente_numero.trim()) errs.push('Numero patente è obbligatorio');
    if (!formData.patente_categoria) errs.push('Categoria patente è obbligatoria');
    if (!formData.patente_data_rilascio) errs.push('Data rilascio patente è obbligatoria');
    if (!formData.patente_data_scadenza) errs.push('Data scadenza patente è obbligatoria');
    
    // Check expiry
    if (formData.patente_data_scadenza) {
      const expiry = new Date(formData.patente_data_scadenza);
      if (expiry < new Date()) {
        errs.push('La patente risulta scaduta. Non è possibile completare la registrazione');
      }
    }
    
    return errs;
  };

  const validateStep3 = () => {
    const errs = [];
    if (!formData.accetta_condizioni) errs.push('Devi accettare le condizioni generali di noleggio');
    if (!formData.accetta_privacy) errs.push('Devi accettare l\'informativa privacy');
    if (!formData.conferma_veridicita) errs.push('Devi confermare la veridicità dei dati inseriti');
    return errs;
  };

  const handleNext = () => {
    let errs = [];
    if (step === 1) errs = validateStep1();
    if (step === 2) errs = validateStep2();
    
    if (errs.length > 0) {
      setErrors(errs);
      toast.error('Correggi gli errori prima di continuare');
      return;
    }
    
    // Auto-fill patente intestatario from anagrafica
    if (step === 1 && !formData.patente_intestatario_nome) {
      setFormData(prev => ({
        ...prev,
        patente_intestatario_nome: prev.nome,
        patente_intestatario_cognome: prev.cognome
      }));
    }
    
    setErrors([]);
    setStep(step + 1);
  };

  const handleBack = () => {
    setErrors([]);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    const errs = validateStep3();
    if (errs.length > 0) {
      setErrors(errs);
      toast.error('Correggi gli errori prima di continuare');
      return;
    }
    
    setLoading(true);
    setErrors([]);
    
    try {
      const submitData = { ...formData };
      delete submitData.conferma_password;
      
      await register(submitData);
      toast.success('Registrazione completata con successo!');
      navigate('/area-cliente');
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.errors) {
        setErrors(detail.errors);
      } else if (typeof detail === 'string') {
        setErrors([detail]);
      } else {
        setErrors(['Errore durante la registrazione. Riprova.']);
      }
      toast.error('Errore nella registrazione');
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-slate-900 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <span style={{ fontFamily: 'Outfit, sans-serif' }}>RE.LE.CO. GROUP</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Registrazione Cliente
          </h1>
          <p className="text-slate-500 mt-2">Compila tutti i campi obbligatori per completare la registrazione</p>
        </div>
        
        {/* Progress */}
        <div className="mb-8">
          <Progress value={progress} className="h-2 mb-4" />
          <div className="flex justify-between">
            {STEPS.map((s) => (
              <div 
                key={s.id} 
                className={`flex items-center gap-2 ${step >= s.id ? 'text-blue-600' : 'text-slate-400'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step >= s.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}
                  ${step === s.id ? 'ring-2 ring-blue-600 ring-offset-2' : ''}
                `}>
                  {step > s.id ? <CheckCircle className="w-5 h-5" /> : s.id}
                </div>
                <span className="hidden sm:inline text-sm font-medium">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Correggi i seguenti errori:</p>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Step 1: Anagrafica */}
        {step === 1 && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <User className="w-5 h-5 text-blue-600" />
                Dati Anagrafici
              </CardTitle>
              <CardDescription>Inserisci i tuoi dati personali completi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input 
                    value={formData.nome} 
                    onChange={(e) => handleChange('nome', e.target.value)}
                    placeholder="Mario"
                    data-testid="reg-nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cognome *</Label>
                  <Input 
                    value={formData.cognome} 
                    onChange={(e) => handleChange('cognome', e.target.value)}
                    placeholder="Rossi"
                    data-testid="reg-cognome"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data di Nascita *</Label>
                  <Input 
                    type="date" 
                    value={formData.data_nascita} 
                    onChange={(e) => handleChange('data_nascita', e.target.value)}
                    data-testid="reg-data-nascita"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Luogo di Nascita *</Label>
                  <Input 
                    value={formData.luogo_nascita} 
                    onChange={(e) => handleChange('luogo_nascita', e.target.value)}
                    placeholder="Roma"
                    data-testid="reg-luogo-nascita"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Codice Fiscale *</Label>
                <Input 
                  value={formData.codice_fiscale} 
                  onChange={(e) => handleChange('codice_fiscale', e.target.value.toUpperCase())}
                  placeholder="RSSMRA80A01H501Z"
                  maxLength={16}
                  data-testid="reg-cf"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Indirizzo di Residenza *</Label>
                <Input 
                  value={formData.indirizzo} 
                  onChange={(e) => handleChange('indirizzo', e.target.value)}
                  placeholder="Via Roma 123"
                  data-testid="reg-indirizzo"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Comune *</Label>
                  <Input 
                    value={formData.comune} 
                    onChange={(e) => handleChange('comune', e.target.value)}
                    placeholder="Roma"
                    data-testid="reg-comune"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provincia *</Label>
                  <Select value={formData.provincia} onValueChange={(v) => handleChange('provincia', v)}>
                    <SelectTrigger data-testid="reg-provincia">
                      <SelectValue placeholder="Sel..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CAP / ZIP *</Label>
                  <Input 
                    value={formData.cap} 
                    onChange={(e) => handleChange('cap', e.target.value)}
                    placeholder="00100 / SW1A 1AA / 75001"
                    maxLength={10}
                    data-testid="reg-cap"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cellulare *</Label>
                  <Input 
                    value={formData.cellulare} 
                    onChange={(e) => handleChange('cellulare', e.target.value)}
                    placeholder="+39 333 1234567"
                    data-testid="reg-cellulare"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="mario.rossi@email.com"
                    data-testid="reg-email"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"}
                      value={formData.password} 
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="Min. 6 caratteri"
                      data-testid="reg-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Clicca l'icona per vedere la password</p>
                </div>
                <div className="space-y-2">
                  <Label>Conferma Password *</Label>
                  <div className="relative">
                    <Input 
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.conferma_password} 
                      onChange={(e) => handleChange('conferma_password', e.target.value)}
                      placeholder="Ripeti password"
                      data-testid="reg-conferma-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Step 2: Patente */}
        {step === 2 && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <CreditCard className="w-5 h-5 text-blue-600" />
                Patente di Guida
              </CardTitle>
              <CardDescription>Inserisci i dati della tua patente di guida valida</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Intestatario *</Label>
                  <Input 
                    value={formData.patente_intestatario_nome} 
                    onChange={(e) => handleChange('patente_intestatario_nome', e.target.value)}
                    data-testid="reg-pat-nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cognome Intestatario *</Label>
                  <Input 
                    value={formData.patente_intestatario_cognome} 
                    onChange={(e) => handleChange('patente_intestatario_cognome', e.target.value)}
                    data-testid="reg-pat-cognome"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Numero Patente *</Label>
                  <Input 
                    value={formData.patente_numero} 
                    onChange={(e) => handleChange('patente_numero', e.target.value)}
                    placeholder="AB1234567X / DVLA-XXX / ecc."
                    maxLength={30}
                    data-testid="reg-pat-numero"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Input 
                    value={formData.patente_categoria} 
                    onChange={(e) => handleChange('patente_categoria', e.target.value.toUpperCase())}
                    placeholder="B, A, US Class C, ..."
                    maxLength={20}
                    className="uppercase"
                    data-testid="reg-pat-categoria"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Rilascio *</Label>
                  <Input 
                    type="date" 
                    value={formData.patente_data_rilascio} 
                    onChange={(e) => handleChange('patente_data_rilascio', e.target.value)}
                    data-testid="reg-pat-rilascio"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Scadenza *</Label>
                  <Input 
                    type="date" 
                    value={formData.patente_data_scadenza} 
                    onChange={(e) => handleChange('patente_data_scadenza', e.target.value)}
                    data-testid="reg-pat-scadenza"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Paese di Rilascio</Label>
                <Input 
                  value={formData.patente_paese_rilascio} 
                  onChange={(e) => handleChange('patente_paese_rilascio', e.target.value)}
                  data-testid="reg-pat-paese"
                />
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                La patente deve essere valida e non scaduta per poter completare la registrazione.
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Step 3: Consensi */}
        {step === 3 && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                <FileCheck className="w-5 h-5 text-blue-600" />
                Consensi e Conferma
              </CardTitle>
              <CardDescription>Leggi e accetta le condizioni per completare la registrazione</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Riepilogo dati */}
              <div className="bg-slate-50 rounded-lg p-4 text-sm">
                <h4 className="font-semibold text-slate-900 mb-2">Riepilogo dati inseriti</h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <p><span className="font-medium">Nome:</span> {formData.nome} {formData.cognome}</p>
                  <p><span className="font-medium">CF:</span> {formData.codice_fiscale}</p>
                  <p><span className="font-medium">Email:</span> {formData.email}</p>
                  <p><span className="font-medium">Cellulare:</span> {formData.cellulare}</p>
                  <p><span className="font-medium">Patente:</span> {formData.patente_numero} ({formData.patente_categoria})</p>
                  <p><span className="font-medium">Scadenza:</span> {formatDateIT(formData.patente_data_scadenza)}</p>
                </div>
              </div>
              
              {/* Consensi */}
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <Checkbox 
                    id="condizioni"
                    checked={formData.accetta_condizioni}
                    onCheckedChange={(v) => handleChange('accetta_condizioni', v)}
                    data-testid="reg-consenso-condizioni"
                  />
                  <div>
                    <Label htmlFor="condizioni" className="font-medium cursor-pointer">
                      Accetto le Condizioni Generali di Noleggio *
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Dichiaro di aver letto e accettato le condizioni generali di noleggio
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <Checkbox 
                    id="privacy"
                    checked={formData.accetta_privacy}
                    onCheckedChange={(v) => handleChange('accetta_privacy', v)}
                    data-testid="reg-consenso-privacy"
                  />
                  <div>
                    <Label htmlFor="privacy" className="font-medium cursor-pointer">
                      Accetto l'Informativa Privacy *
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Autorizzo il trattamento dei miei dati personali ai sensi del GDPR
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                  <Checkbox 
                    id="veridicita"
                    checked={formData.conferma_veridicita}
                    onCheckedChange={(v) => handleChange('conferma_veridicita', v)}
                    data-testid="reg-consenso-veridicita"
                  />
                  <div>
                    <Label htmlFor="veridicita" className="font-medium cursor-pointer">
                      Confermo la Veridicità dei Dati *
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Dichiaro che tutti i dati inseriti sono veritieri e corrispondono ai documenti in mio possesso
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <Button variant="outline" onClick={handleBack} data-testid="btn-back">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Indietro
            </Button>
          ) : (
            <Link to="/">
              <Button variant="outline">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Torna alla Home
              </Button>
            </Link>
          )}
          
          {step < STEPS.length ? (
            <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700" data-testid="btn-next">
              Avanti
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              className="bg-green-600 hover:bg-green-700"
              disabled={loading}
              data-testid="btn-submit"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrazione...
                </span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completa Registrazione
                </>
              )}
            </Button>
          )}
        </div>
        
        {/* Login link */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Hai già un account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
