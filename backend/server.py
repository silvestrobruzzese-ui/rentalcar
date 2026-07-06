from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta, date
import jwt
import bcrypt
from io import BytesIO
import re
import base64
import asyncio

# Resend for emails
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'autorent-secret-key-2026')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Agency Fixed Data
AGENCY_DATA = {
    "ragione_sociale": "RE.LE.CO. GROUP",
    "indirizzo": "Corso Umberto, 220",
    "cap": "88068",
    "comune": "Soverato",
    "provincia": "CZ",
    "regione": "Calabria",
    "piva": "03406230791",
    "cf": "03406230791",
    "telefono": "3342370420",
    "email": "giannibruzzese@gmail.com",
    "sede_checkin": {
        "nome": "Sede Principale",
        "regione": "Calabria",
        "provincia": "CZ",
        "comune": "Soverato",
        "cap": "88068",
        "indirizzo": "Via Giordano Bruno"
    }
}

# Email Configuration - loaded later after logger is defined
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Brevo SMTP Configuration
BREVO_SMTP_SERVER = os.environ.get('BREVO_SMTP_SERVER', '')
BREVO_SMTP_PORT = int(os.environ.get('BREVO_SMTP_PORT', '587'))
BREVO_SMTP_LOGIN = os.environ.get('BREVO_SMTP_LOGIN', '')
BREVO_SMTP_KEY = os.environ.get('BREVO_SMTP_KEY', '')
BREVO_SENDER_EMAIL = os.environ.get('BREVO_SENDER_EMAIL', 'giannibruzzese@gmail.com')
BREVO_SENDER_NAME = os.environ.get('BREVO_SENDER_NAME', 'Soverato Rental')
BREVO_CONFIGURED = bool(BREVO_SMTP_SERVER and BREVO_SMTP_LOGIN and BREVO_SMTP_KEY)

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_brevo_email(to_email: str, to_name: str, subject: str, html_content: str):
    """Send email via Brevo SMTP"""
    if not BREVO_CONFIGURED:
        logger.warning("Brevo not configured - email not sent")
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'{BREVO_SENDER_NAME} <{BREVO_SENDER_EMAIL}>'
        msg['To'] = f'{to_name} <{to_email}>'
        msg.attach(MIMEText(html_content, 'html'))
        
        server = smtplib.SMTP(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, timeout=10)
        server.starttls()
        server.login(BREVO_SMTP_LOGIN, BREVO_SMTP_KEY)
        server.sendmail(BREVO_SENDER_EMAIL, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Brevo email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Brevo email error: {e}")
        return False

def build_return_reminder_html(prenotazione: dict) -> str:
    """Build HTML email for vehicle return reminder (5h before)"""
    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 25px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">SOVERATO RENTAL</h1>
            <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">RE.LE.CO. GROUP S.R.L.</p>
        </div>
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 0 0 12px 12px;">
            <h2 style="color: #856404; margin-top: 0;">Promemoria Riconsegna Veicolo</h2>
            <p style="color: #664d03;">Gentile <strong>{prenotazione.get('cliente_nome', 'Cliente')}</strong>,</p>
            <p style="color: #664d03;">Le ricordiamo che la riconsegna del veicolo noleggiato e' prevista tra circa <strong>5 ore</strong>.</p>
            
            <div style="background: white; border-radius: 8px; padding: 15px; margin: 15px 0; border: 1px solid #e0e0e0;">
                <table style="width: 100%; font-size: 14px; color: #333;">
                    <tr><td style="padding: 5px 0; color: #666;">Veicolo:</td><td style="padding: 5px 0;"><strong>{prenotazione.get('veicolo_marca', '')} {prenotazione.get('veicolo_modello', '')}</strong></td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">Targa:</td><td style="padding: 5px 0;"><strong>{prenotazione.get('veicolo_targa', '')}</strong></td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">Data riconsegna:</td><td style="padding: 5px 0;"><strong>{prenotazione.get('data_riconsegna', '')} ore {prenotazione.get('ora_riconsegna', '18:00')}</strong></td></tr>
                    <tr><td style="padding: 5px 0; color: #666;">Luogo:</td><td style="padding: 5px 0;"><strong>{prenotazione.get('luogo_riconsegna', 'Sede Principale')}</strong></td></tr>
                </table>
            </div>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 12px; margin: 15px 0; font-size: 13px; color: #555;">
                <strong>Cosa portare:</strong>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>Chiavi del veicolo</li>
                    <li>Documento d'identita'</li>
                    <li>Veicolo con stesso livello carburante del ritiro</li>
                </ul>
            </div>
            
            <p style="color: #664d03; font-size: 13px;">In caso di ritardo, si prega di contattarci al <strong>334 237 0420</strong>.</p>
        </div>
        <div style="text-align: center; padding: 15px; font-size: 11px; color: #999;">
            <p>Soverato Rental - RE.LE.CO. GROUP S.R.L.</p>
            <p>Corso Umberto, 220 - 88068 Soverato (CZ)</p>
            <p>Tel: 334 237 0420 | Email: giannibruzzese@gmail.com</p>
        </div>
    </body>
    </html>
    """

async def send_booking_confirmation_email(cliente_email: str, cliente_nome: str, prenotazione: dict):
    """Send booking confirmation email when approved"""
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">RE.LE.CO. GROUP</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Autonoleggio</p>
        </div>
        
        <div style="padding: 20px; background-color: #f8fafc;">
            <h2 style="color: #1e40af;">Conferma Prenotazione Approvata</h2>
            
            <p>Gentile <strong>{cliente_nome}</strong>,</p>
            
            <p>Siamo lieti di comunicarle che la sua prenotazione è stata <strong style="color: green;">APPROVATA</strong>.</p>
            
            <div style="background-color: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1e40af; margin-top: 0;">Dettagli Contratto</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Veicolo:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">{prenotazione.get('veicolo_marca', '')} {prenotazione.get('veicolo_modello', '')} - {prenotazione.get('veicolo_targa', '')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Data Ritiro:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">{prenotazione.get('data_ritiro', '')} ore {prenotazione.get('ora_ritiro', '')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Data Riconsegna:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">{prenotazione.get('data_riconsegna', '')} ore {prenotazione.get('ora_riconsegna', '')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Durata:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">{prenotazione.get('durata_giorni', '')} giorni</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Km Inclusi:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">{prenotazione.get('km_inclusi_totali', '')} km</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Totale:</strong></td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 18px; color: #1e40af;"><strong>€{prenotazione.get('tariffa_base', 0):.2f}</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;"><strong>Deposito Cauzionale:</strong></td>
                        <td style="padding: 8px 0;">€{prenotazione.get('deposito_cauzionale', 0):.2f}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #92400e; margin-top: 0;">Cosa portare al ritiro:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                    <li>Documento d'identità valido</li>
                    <li>Patente di guida in corso di validità</li>
                    <li>Carta di credito intestata al conducente</li>
                    <li>Codice fiscale</li>
                </ul>
            </div>
            
            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px;">
                <h4 style="color: #1e40af; margin-top: 0;">Luogo di Ritiro</h4>
                <p style="margin: 0;">
                    <strong>{AGENCY_DATA['ragione_sociale']}</strong><br>
                    {AGENCY_DATA['indirizzo']}<br>
                    {AGENCY_DATA['cap']} {AGENCY_DATA['comune']} ({AGENCY_DATA['provincia']})<br>
                    Tel: {AGENCY_DATA['telefono']}
                </p>
            </div>
            
            <p style="margin-top: 20px;">
                La aspettiamo il giorno <strong>{prenotazione.get('data_ritiro', '')}</strong> alle ore <strong>{prenotazione.get('ora_ritiro', '')}</strong> 
                per la firma del contratto e il ritiro del veicolo.
            </p>
            
            <p>Per qualsiasi informazione, non esiti a contattarci.</p>
            
            <p>Cordiali saluti,<br>
            <strong>RE.LE.CO. GROUP</strong></p>
        </div>
        
        <div style="background-color: #1e3a5f; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">{AGENCY_DATA['ragione_sociale']} - {AGENCY_DATA['indirizzo']}, {AGENCY_DATA['cap']} {AGENCY_DATA['comune']} ({AGENCY_DATA['provincia']})</p>
            <p style="margin: 5px 0 0 0;">P.IVA: {AGENCY_DATA['piva']} - Tel: {AGENCY_DATA['telefono']} - Email: {AGENCY_DATA['email']}</p>
        </div>
    </body>
    </html>
    """
    
    if RESEND_AVAILABLE and RESEND_API_KEY:
        try:
            params = {
                "from": SENDER_EMAIL,
                "to": [cliente_email],
                "subject": f"RE.LE.CO. GROUP - Conferma Prenotazione Approvata - {prenotazione.get('veicolo_targa', '')}",
                "html": html_content
            }
            email_result = await asyncio.to_thread(resend.Emails.send, params)
            logger.info(f"Email sent to {cliente_email}: {email_result}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False
    else:
        logger.info(f"[EMAIL LOG] Would send confirmation to {cliente_email}")
        logger.info(f"Subject: Conferma Prenotazione - {prenotazione.get('veicolo_targa', '')}")
        return False

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Resend email service
if RESEND_AVAILABLE and RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY
    logger.info("Resend email service configured")
else:
    logger.warning("Resend not configured - emails will be logged only")

# Initialize Brevo email service
if BREVO_CONFIGURED:
    logger.info(f"Brevo SMTP configured: {BREVO_SMTP_SERVER}:{BREVO_SMTP_PORT}")
else:
    logger.warning("Brevo SMTP not configured")

# ========== BACKGROUND TASK: RETURN REMINDER (5h before) ==========

async def check_return_reminders():
    """Check for bookings with return in ~5 hours and send reminder email"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            # Target: returns happening in 4.5 to 5.5 hours from now (in UTC)
            target_min = now + timedelta(hours=4, minutes=30)
            target_max = now + timedelta(hours=5, minutes=30)
            
            # Make naive for comparison with parsed dates
            target_min_naive = target_min.replace(tzinfo=None)
            target_max_naive = target_max.replace(tzinfo=None)
            
            # Get all active bookings (approvata, contratto_generato, consegnato)
            active_statuses = ["approvata", "contratto_generato", "consegnato"]
            bookings = await db.prenotazioni.find(
                {"status": {"$in": active_statuses}},
                {"_id": 0}
            ).to_list(500)
            
            for booking in bookings:
                try:
                    # Parse return datetime (assume Europe/Rome timezone, +2h from UTC in summer)
                    data_ric = booking.get("data_riconsegna", "")
                    ora_ric = booking.get("ora_riconsegna", "18:00")
                    if not data_ric:
                        continue
                    
                    return_dt = datetime.strptime(f"{data_ric} {ora_ric}", "%Y-%m-%d %H:%M")
                    # Approximate: treat as UTC+2 (Italy)
                    return_dt_utc = return_dt - timedelta(hours=2)
                    
                    # Check if return is in the 5h window
                    if target_min_naive <= return_dt_utc <= target_max_naive:
                        # Check if reminder already sent
                        reminder_key = f"reminder_5h_{booking['id']}"
                        already_sent = await db.email_log.find_one({"key": reminder_key})
                        
                        if not already_sent:
                            email = booking.get("cliente_email", "")
                            nome = booking.get("cliente_nome", "Cliente")
                            
                            if email and BREVO_CONFIGURED:
                                html = build_return_reminder_html(booking)
                                subject = f"Promemoria: Riconsegna {booking.get('veicolo_marca', '')} {booking.get('veicolo_modello', '')} oggi alle {ora_ric}"
                                
                                success = send_brevo_email(email, nome, subject, html)
                                
                                # Log the reminder (avoid duplicates)
                                await db.email_log.insert_one({
                                    "key": reminder_key,
                                    "booking_id": booking["id"],
                                    "email": email,
                                    "type": "return_reminder_5h",
                                    "sent": success,
                                    "sent_at": datetime.now(timezone.utc).isoformat()
                                })
                                
                                if success:
                                    logger.info(f"Return reminder sent to {email} for booking {booking['id']}")
                            else:
                                logger.info(f"Return reminder skipped for {booking['id']}: no email or Brevo not configured")
                except Exception as e:
                    logger.error(f"Error processing reminder for booking {booking.get('id', '?')}: {e}")
                    
        except Exception as e:
            logger.error(f"Return reminder check error: {e}")
        
        # Check every 15 minutes
        await asyncio.sleep(900)

@app.on_event("startup")
async def start_reminder_task():
    """Start the background reminder task"""
    asyncio.create_task(check_return_reminders())
    asyncio.create_task(weekly_calendar_email())
    logger.info("Background tasks started: return reminders (15min) + weekly calendar email (Sun 18:00)")

# ========== WEEKLY CALENDAR EXCEL EMAIL (Every Sunday at 18:00) ==========

async def weekly_calendar_email():
    """Send weekly calendar Excel to soverato.rental@libero.it every Sunday at 18:00 (Italy)"""
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from io import BytesIO
    import base64
    
    while True:
        try:
            # Check if it's Sunday 18:00 (Italy = UTC+2)
            now_utc = datetime.now(timezone.utc)
            now_italy = now_utc + timedelta(hours=2)
            
            is_sunday = now_italy.weekday() == 6  # 0=Mon, 6=Sun
            is_target_hour = now_italy.hour == 18 and now_italy.minute < 15
            
            if is_sunday and is_target_hour:
                # Check if already sent today
                today_key = f"weekly_calendar_{now_italy.strftime('%Y-%m-%d')}"
                already_sent = await db.email_log.find_one({"key": today_key})
                
                if not already_sent:
                    logger.info("Generating weekly calendar Excel...")
                    
                    # Fetch all bookings
                    bookings = await db.prenotazioni.find(
                        {"status": {"$nin": ["annullata"]}},
                        {"_id": 0}
                    ).sort("data_ritiro", 1).to_list(1000)
                    
                    # Fetch calendar notes
                    notes = await db.calendar_notes.find({}, {"_id": 0}).sort("data", 1).to_list(500)
                    
                    # Create Excel
                    wb = openpyxl.Workbook()
                    
                    # --- Sheet 1: Prenotazioni ---
                    ws = wb.active
                    ws.title = "Prenotazioni"
                    
                    header_font = Font(bold=True, color="FFFFFF", size=10)
                    header_fill = PatternFill(start_color="1a2744", end_color="1a2744", fill_type="solid")
                    thin_border = Border(
                        left=Side(style='thin'), right=Side(style='thin'),
                        top=Side(style='thin'), bottom=Side(style='thin')
                    )
                    
                    headers = ["Stato", "Cliente", "Email", "Cellulare", "Veicolo", "Targa", 
                               "Data Ritiro", "Ora Ritiro", "Data Riconsegna", "Ora Riconsegna",
                               "Giorni", "Tariffa/gg", "Totale", "Note"]
                    
                    for col, h in enumerate(headers, 1):
                        cell = ws.cell(row=1, column=col, value=h)
                        cell.font = header_font
                        cell.fill = header_fill
                        cell.alignment = Alignment(horizontal='center')
                        cell.border = thin_border
                    
                    # Status colors
                    status_fills = {
                        'bozza': PatternFill(start_color="E0E0E0", end_color="E0E0E0", fill_type="solid"),
                        'in_verifica': PatternFill(start_color="FFF9C4", end_color="FFF9C4", fill_type="solid"),
                        'approvata': PatternFill(start_color="C8E6C9", end_color="C8E6C9", fill_type="solid"),
                        'contratto_generato': PatternFill(start_color="BBDEFB", end_color="BBDEFB", fill_type="solid"),
                        'consegnato': PatternFill(start_color="E1BEE7", end_color="E1BEE7", fill_type="solid"),
                        'chiuso': PatternFill(start_color="CFD8DC", end_color="CFD8DC", fill_type="solid"),
                    }
                    
                    for row_idx, b in enumerate(bookings, 2):
                        data_ritiro = b.get('data_ritiro', '')
                        data_riconsegna = b.get('data_riconsegna', '')
                        if data_ritiro and len(data_ritiro) >= 10:
                            data_ritiro = f"{data_ritiro[8:10]}/{data_ritiro[5:7]}/{data_ritiro[:4]}"
                        if data_riconsegna and len(data_riconsegna) >= 10:
                            data_riconsegna = f"{data_riconsegna[8:10]}/{data_riconsegna[5:7]}/{data_riconsegna[:4]}"
                        
                        values = [
                            b.get('status', ''),
                            b.get('cliente_nome', ''),
                            b.get('cliente_email', ''),
                            b.get('cliente_cellulare', ''),
                            f"{b.get('veicolo_marca', '')} {b.get('veicolo_modello', '')}",
                            b.get('veicolo_targa', ''),
                            data_ritiro,
                            b.get('ora_ritiro', ''),
                            data_riconsegna,
                            b.get('ora_riconsegna', ''),
                            b.get('durata_giorni', ''),
                            b.get('tariffa_giornaliera', ''),
                            b.get('tariffa_base', ''),
                            b.get('note', '')
                        ]
                        
                        fill = status_fills.get(b.get('status', ''), None)
                        for col, v in enumerate(values, 1):
                            cell = ws.cell(row=row_idx, column=col, value=v)
                            cell.border = thin_border
                            if fill:
                                cell.fill = fill
                    
                    # Auto-width columns
                    for col in ws.columns:
                        max_len = max((len(str(cell.value or '')) for cell in col), default=10)
                        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 25)
                    
                    # --- Sheet 2: Note Calendario ---
                    ws2 = wb.create_sheet("Note Calendario")
                    note_headers = ["Data", "Titolo", "Contenuto"]
                    for col, h in enumerate(note_headers, 1):
                        cell = ws2.cell(row=1, column=col, value=h)
                        cell.font = header_font
                        cell.fill = PatternFill(start_color="E65100", end_color="E65100", fill_type="solid")
                        cell.alignment = Alignment(horizontal='center')
                        cell.border = thin_border
                    
                    for row_idx, n in enumerate(notes, 2):
                        data_nota = n.get('data', '')
                        if data_nota and len(data_nota) >= 10:
                            data_nota = f"{data_nota[8:10]}/{data_nota[5:7]}/{data_nota[:4]}"
                        ws2.cell(row=row_idx, column=1, value=data_nota).border = thin_border
                        ws2.cell(row=row_idx, column=2, value=n.get('titolo', '')).border = thin_border
                        ws2.cell(row=row_idx, column=3, value=n.get('contenuto', '')).border = thin_border
                    
                    for col in ws2.columns:
                        max_len = max((len(str(cell.value or '')) for cell in col), default=10)
                        ws2.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)
                    
                    # Save to bytes
                    excel_buffer = BytesIO()
                    wb.save(excel_buffer)
                    excel_bytes = excel_buffer.getvalue()
                    
                    # Send email with attachment via Brevo SMTP
                    if BREVO_CONFIGURED:
                        from email.mime.base import MIMEBase
                        from email import encoders
                        
                        msg = MIMEMultipart('mixed')
                        msg['Subject'] = f"Calendario Prenotazioni - Settimana del {now_italy.strftime('%d/%m/%Y')}"
                        msg['From'] = f'{BREVO_SENDER_NAME} <{BREVO_SENDER_EMAIL}>'
                        msg['To'] = 'Soverato Rental <soverato.rental@libero.it>'
                        
                        html_body = f"""
                        <html><body>
                        <h2>Calendario Prenotazioni Settimanale</h2>
                        <p>In allegato il file Excel con tutte le prenotazioni e le note del calendario.</p>
                        <p><strong>Data generazione:</strong> {now_italy.strftime('%d/%m/%Y ore %H:%M')}</p>
                        <p><strong>Prenotazioni attive:</strong> {len(bookings)}</p>
                        <p><strong>Note calendario:</strong> {len(notes)}</p>
                        <br>
                        <p><em>Soverato Rental - RE.LE.CO GROUP</em></p>
                        </body></html>
                        """
                        msg.attach(MIMEText(html_body, 'html'))
                        
                        attachment = MIMEBase('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                        attachment.set_payload(excel_bytes)
                        encoders.encode_base64(attachment)
                        filename = f"calendario_prenotazioni_{now_italy.strftime('%d_%m_%Y')}.xlsx"
                        attachment.add_header('Content-Disposition', 'attachment', filename=filename)
                        msg.attach(attachment)
                        
                        try:
                            server = smtplib.SMTP(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, timeout=15)
                            server.starttls()
                            server.login(BREVO_SMTP_LOGIN, BREVO_SMTP_KEY)
                            server.sendmail(BREVO_SENDER_EMAIL, ['soverato.rental@libero.it'], msg.as_string())
                            server.quit()
                            logger.info(f"Weekly calendar Excel sent to soverato.rental@libero.it ({len(bookings)} bookings, {len(notes)} notes)")
                            
                            await db.email_log.insert_one({
                                "key": today_key,
                                "email": "soverato.rental@libero.it",
                                "type": "weekly_calendar_excel",
                                "sent": True,
                                "bookings_count": len(bookings),
                                "notes_count": len(notes),
                                "sent_at": datetime.now(timezone.utc).isoformat()
                            })
                        except Exception as e:
                            logger.error(f"Error sending weekly calendar email: {e}")
                    else:
                        logger.warning("Brevo not configured - weekly calendar not sent")
                        
        except Exception as e:
            logger.error(f"Weekly calendar task error: {e}")
        
        # Check every 10 minutes
        await asyncio.sleep(600)

# ========== VALIDATION HELPERS ==========

def validate_codice_fiscale(cf: str) -> bool:
    """Validate Italian Codice Fiscale format"""
    if not cf:
        return False
    cf = cf.upper().strip()
    if len(cf) != 16:
        return False
    pattern = r'^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$'
    return bool(re.match(pattern, cf))

def validate_phone(phone: str) -> bool:
    """Validate phone number format"""
    if not phone:
        return False
    cleaned = re.sub(r'[\s\-\.\(\)]', '', phone)
    if cleaned.startswith('+'):
        cleaned = cleaned[1:]
    return len(cleaned) >= 9 and cleaned.isdigit()

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def is_date_expired(date_str: str) -> bool:
    """Check if a date string (YYYY-MM-DD) is in the past"""
    try:
        exp_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        return exp_date < date.today()
    except:
        return True

# ========== MODELS ==========

class ClienteAnagrafica(BaseModel):
    nome: str
    cognome: str
    data_nascita: str
    luogo_nascita: str
    codice_fiscale: str
    indirizzo: str
    comune: str
    provincia: str
    cap: str
    stato: str = "Italia"
    cellulare: str
    email: EmailStr

class PatenteDati(BaseModel):
    intestatario_nome: str
    intestatario_cognome: str
    numero: str
    categoria: str
    data_rilascio: str
    data_scadenza: str
    paese_rilascio: str = "Italia"

class ClienteRegistration(BaseModel):
    # Anagrafica
    nome: str
    cognome: str
    data_nascita: str
    luogo_nascita: str
    codice_fiscale: str
    indirizzo: str
    comune: str
    provincia: str
    cap: str
    stato: str = "Italia"
    cellulare: str
    email: EmailStr
    password: str
    # Patente
    patente_intestatario_nome: str
    patente_intestatario_cognome: str
    patente_numero: str
    patente_categoria: str
    patente_data_rilascio: str
    patente_data_scadenza: str
    patente_paese_rilascio: str = "Italia"
    # Consensi
    accetta_condizioni: bool
    accetta_privacy: bool
    conferma_veridicita: bool

class ConducenteAggiuntivo(BaseModel):
    nome: str
    cognome: str
    data_nascita: str
    luogo_nascita: str
    codice_fiscale: str
    indirizzo: str
    comune: str
    provincia: str
    cap: str
    cellulare: str
    email: Optional[str] = None
    patente_numero: str
    patente_categoria: str
    patente_data_rilascio: str
    patente_data_scadenza: str
    patente_paese_rilascio: str = "Italia"

class VeicoloCreate(BaseModel):
    marca: str
    modello: str
    targa: str
    colore: str
    cambio: str  # manuale, automatico
    alimentazione: str  # benzina, diesel, gpl, metano, elettrico, ibrido
    anno: int
    posti: int = 5
    km_attuali: int = 0
    tariffa_giornaliera: float
    deposito_cauzionale: float = 500.0
    km_inclusi_giorno: int = 200
    prezzo_km_extra: float = 0.25
    image_url: Optional[str] = None

class PrenotazioneCreate(BaseModel):
    veicolo_id: str
    data_ritiro: str
    ora_ritiro: str
    data_riconsegna: str
    ora_riconsegna: str
    conducenti_aggiuntivi: Optional[List[ConducenteAggiuntivo]] = []
    note: Optional[str] = None

class CheckInData(BaseModel):
    km_uscita: int
    tacche_carburante: int  # 0-8
    luogo_ritiro: Optional[str] = None
    indirizzo_ritiro: Optional[str] = None
    danni_preesistenti: Optional[List[Dict[str, str]]] = []
    note: Optional[str] = None

class CheckOutData(BaseModel):
    data_ora_rientro: str
    km_entrata: int
    tacche_carburante_entrata: int
    danni_veicolo: Optional[float] = 0
    costo_gestione_danni: Optional[float] = 0
    carburante_mancante: Optional[float] = 0
    pulizia_straordinaria: Optional[float] = 0
    altri_addebiti: Optional[float] = 0
    note_addebiti: Optional[str] = None

class FranchigiaCreate(BaseModel):
    nome: str
    descrizione: str
    importo_massimo: float = 0
    costo_giornaliero: float = 0
    codice: Optional[str] = None
    percentuale_scoperto: Optional[float] = None

class ServizioSupplementareCreate(BaseModel):
    nome: str
    descrizione: str
    prezzo_unitario: float
    unita: str = "giorno"

class CondizioniGeneraliUpdate(BaseModel):
    testo: str

class GaranziaPagamento(BaseModel):
    garante_nome: Optional[str] = None
    garante_recapiti: Optional[str] = None
    garante_documento: Optional[str] = None
    carta_circuito: Optional[str] = None
    carta_intestatario: Optional[str] = None
    carta_ultime_cifre: Optional[str] = None
    carta_scadenza: Optional[str] = None
    metodo_pagamento: str = "contanti"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    nome: str
    cognome: str
    role: str
    registrazione_completa: bool

# ========== AUTH HELPERS ==========

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utente non trovato")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
        return user
    except:
        return None

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accesso riservato agli amministratori")
    return user

# ========== AUTH ROUTES ==========

@api_router.post("/auth/register")
async def register_client(data: ClienteRegistration):
    # Validations
    errors = []
    
    if not validate_codice_fiscale(data.codice_fiscale):
        errors.append("Codice fiscale non valido (deve essere di 16 caratteri)")
    
    if not validate_phone(data.cellulare):
        errors.append("Numero di telefono non valido")
    
    if not validate_email(data.email):
        errors.append("Email non valida")
    
    if is_date_expired(data.patente_data_scadenza):
        errors.append("La patente risulta scaduta. Non è possibile completare la registrazione")
    
    if not data.accetta_condizioni:
        errors.append("Devi accettare le condizioni generali di noleggio")
    
    if not data.accetta_privacy:
        errors.append("Devi accettare l'informativa privacy")
    
    if not data.conferma_veridicita:
        errors.append("Devi confermare la veridicità dei dati inseriti")
    
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    # Check existing
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "password_chiaro": data.password,  # Password in chiaro per la direzione
        "role": "client",
        "registrazione_completa": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        # Anagrafica
        "nome": data.nome,
        "cognome": data.cognome,
        "data_nascita": data.data_nascita,
        "luogo_nascita": data.luogo_nascita,
        "codice_fiscale": data.codice_fiscale.upper(),
        "indirizzo": data.indirizzo,
        "comune": data.comune,
        "provincia": data.provincia,
        "cap": data.cap,
        "stato": data.stato,
        "cellulare": data.cellulare,
        # Patente
        "patente": {
            "intestatario_nome": data.patente_intestatario_nome,
            "intestatario_cognome": data.patente_intestatario_cognome,
            "numero": data.patente_numero,
            "categoria": data.patente_categoria,
            "data_rilascio": data.patente_data_rilascio,
            "data_scadenza": data.patente_data_scadenza,
            "paese_rilascio": data.patente_paese_rilascio
        },
        # Consensi
        "consensi": {
            "condizioni": data.accetta_condizioni,
            "privacy": data.accetta_privacy,
            "veridicita": data.conferma_veridicita,
            "data_consenso": datetime.now(timezone.utc).isoformat()
        }
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id, data.email, "client")
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": data.email,
            "nome": data.nome,
            "cognome": data.cognome,
            "role": "client",
            "registrazione_completa": True
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    token = create_token(user["id"], user["email"], user["role"])
    user_response = {k: v for k, v in user.items() if k != "password"}
    
    return {"token": token, "user": user_response}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@api_router.put("/auth/profile")
async def update_my_profile(data: dict, user: dict = Depends(get_current_user)):
    """Client can update their own profile"""
    allowed_fields = [
        "nome", "cognome", "data_nascita", "luogo_nascita", "codice_fiscale",
        "indirizzo", "comune", "provincia", "cap", "stato", "cellulare",
        "patente", "carta_credito"
    ]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated

# ========== AGENCY DATA ==========

@api_router.get("/agency")
async def get_agency_data():
    """Get fixed agency data"""
    return AGENCY_DATA

@api_router.get("/settings/condizioni-generali")
async def get_condizioni_generali():
    """Get general rental conditions"""
    settings = await db.settings.find_one({"type": "condizioni_generali"}, {"_id": 0})
    if not settings:
        # Default conditions
        default_text = """1. DEFINIZIONI: Per "Locatore" si intende RE.LE.CO. GROUP. Per "Locatario" si intende il cliente che sottoscrive il presente contratto.

2. CONSEGNA DEL VEICOLO: Il Locatario dichiara di aver ricevuto il veicolo in perfetto stato di manutenzione e funzionamento.

3. ETÀ E PATENTE: Il conducente deve avere almeno 21 anni di età e patente di guida valida da almeno 1 anno.

4. PROROGA: Eventuali proroghe devono essere concordate preventivamente con il Locatore.

5. RISOLUZIONE: Il contratto si intende risolto in caso di violazione delle condizioni stabilite, ai sensi dell'art. 1456 c.c.

6. RITARDO NELLA RICONSEGNA: In caso di ritardo nella riconsegna superiore a 30 minuti, verrà addebitata una giornata aggiuntiva.

7. DEPOSITO CAUZIONALE: È richiesto un deposito cauzionale a garanzia del corretto utilizzo del veicolo.

8. PAGAMENTO: Il pagamento del corrispettivo deve avvenire anticipatamente. Il Locatore è autorizzato ad addebitare sulla carta di credito eventuali importi dovuti.

9. CARBURANTE: Il carburante è a carico del Locatario. Il veicolo deve essere riconsegnato con lo stesso livello di carburante.

10. USO DILIGENTE: Il Locatario si impegna a utilizzare il veicolo con la diligenza del buon padre di famiglia e a non consentire la guida a persone non autorizzate.

11. MANUTENZIONE E RIPARAZIONI: In caso di guasti o malfunzionamenti, il Locatario deve contattare immediatamente il Locatore.

12. DANNI: Il Locatario è responsabile per tutti i danni causati al veicolo durante il periodo di noleggio, dedotta l'eventuale franchigia.

13. ASSICURAZIONE: Il veicolo è coperto da assicurazione RCA. Eventuali franchigie sono a carico del Locatario.

14. SINISTRI: In caso di sinistro, furto o incendio, il Locatario deve avvisare immediatamente il Locatore e le autorità competenti.

15. FORO COMPETENTE: Per qualsiasi controversia sarà competente il Foro di Catanzaro."""
        return {"testo": default_text}
    return settings

@api_router.put("/settings/condizioni-generali")
async def update_condizioni_generali(data: CondizioniGeneraliUpdate, admin: dict = Depends(get_admin_user)):
    """Update general rental conditions"""
    await db.settings.update_one(
        {"type": "condizioni_generali"},
        {"$set": {"type": "condizioni_generali", "testo": data.testo, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Condizioni aggiornate"}

# ========== AGENZIA SETTINGS ==========

@api_router.get("/settings/agenzia")
async def get_agenzia_settings():
    """Get agency settings"""
    settings = await db.settings.find_one({"type": "agenzia"}, {"_id": 0})
    if not settings:
        # Default values
        return {
            "ragione_sociale": "Soverato Rental",
            "slogan": "Il noleggio che conviene",
            "indirizzo": "Corso Umberto, 220",
            "cap": "88068",
            "comune": "Soverato",
            "provincia": "CZ",
            "regione": "Calabria",
            "piva": "03406230791",
            "cf": "03406230791",
            "telefono": "3342370420",
            "email": "soveratorental@libero.it",
            "logo_url": "/images/logo_agenzia.png"
        }
    # Remove internal fields
    settings.pop("type", None)
    return settings

@api_router.put("/settings/agenzia")
async def update_agenzia_settings(data: dict, admin: dict = Depends(get_admin_user)):
    """Update agency settings"""
    allowed_fields = [
        "ragione_sociale", "slogan", "indirizzo", "cap", "comune", "provincia",
        "regione", "piva", "cf", "telefono", "email", "logo_url"
    ]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["type"] = "agenzia"
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"type": "agenzia"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Dati agenzia aggiornati"}

# ========== TARIFFE STAGIONALI ==========

@api_router.get("/settings/tariffe-stagionali")
async def get_tariffe_stagionali():
    """Get seasonal pricing periods"""
    tariffe = await db.tariffe_stagionali.find({}, {"_id": 0}).to_list(100)
    return tariffe

@api_router.post("/settings/tariffe-stagionali")
async def create_tariffa_stagionale(data: dict, admin: dict = Depends(get_admin_user)):
    """Create a seasonal pricing period - can be tied to a specific vehicle"""
    tariffa = {
        "id": str(uuid.uuid4()),
        "nome": data.get("nome"),
        "data_inizio": data.get("data_inizio"),
        "data_fine": data.get("data_fine"),
        "tariffa_giornaliera": float(data.get("tariffa_giornaliera", 0)),
        "descrizione": data.get("descrizione", ""),
        "veicolo_id": data.get("veicolo_id"),  # None = tutti i veicoli, ID specifico = solo quel veicolo
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tariffe_stagionali.insert_one(tariffa)
    tariffa.pop("_id", None)
    return tariffa

@api_router.delete("/settings/tariffe-stagionali/{tariffa_id}")
async def delete_tariffa_stagionale(tariffa_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a seasonal pricing period"""
    result = await db.tariffe_stagionali.delete_one({"id": tariffa_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tariffa non trovata")
    return {"message": "Tariffa eliminata"}

@api_router.put("/settings/tariffe-stagionali/{tariffa_id}")
async def update_tariffa_stagionale(tariffa_id: str, data: dict, admin: dict = Depends(get_admin_user)):
    """Update a seasonal pricing period"""
    update_data = {
        "nome": data.get("nome"),
        "data_inizio": data.get("data_inizio"),
        "data_fine": data.get("data_fine"),
        "tariffa_giornaliera": float(data.get("tariffa_giornaliera", 0)),
        "descrizione": data.get("descrizione", ""),
        "veicolo_id": data.get("veicolo_id"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.tariffe_stagionali.update_one(
        {"id": tariffa_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tariffa non trovata")
    return {"message": "Tariffa aggiornata", **update_data, "id": tariffa_id}

@api_router.get("/calcola-prezzo-dinamico")
async def calcola_prezzo_dinamico(
    veicolo_id: str,
    data_inizio: str,
    data_fine: str
):
    """
    Calculate dynamic price based on seasonal rates.
    Returns the applicable daily rate for the given vehicle and date range.
    Priority: 
    1) Vehicle-specific rate with SHORTEST period (most specific)
    2) General rate with SHORTEST period
    3) Vehicle base price
    """
    from datetime import datetime as dt
    
    # Get vehicle base price
    vehicle = await db.vehicles.find_one({"id": veicolo_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    
    base_price = vehicle.get("tariffa_giornaliera", vehicle.get("base_price", 50))
    
    # Get all seasonal rates
    tariffe = await db.tariffe_stagionali.find({}, {"_id": 0}).to_list(100)
    
    # Parse dates
    try:
        start_date = dt.strptime(data_inizio, "%Y-%m-%d").date()
        end_date = dt.strptime(data_fine, "%Y-%m-%d").date()
    except:
        return {
            "tariffa_giornaliera": base_price,
            "tariffa_applicata": "base",
            "nome_tariffa": "Tariffa Base Veicolo"
        }
    
    # Find ALL matching seasonal rates
    tariffe_specifiche = []  # Vehicle-specific rates
    tariffe_generali = []    # General rates (all vehicles)
    
    for t in tariffe:
        try:
            t_inizio = dt.strptime(t["data_inizio"], "%Y-%m-%d").date()
            t_fine = dt.strptime(t["data_fine"], "%Y-%m-%d").date()
            
            # Check if booking start date falls within this seasonal period
            if start_date >= t_inizio and start_date <= t_fine:
                # Calculate period length (shorter = more specific)
                durata_periodo = (t_fine - t_inizio).days
                t["_durata_periodo"] = durata_periodo
                
                if t.get("veicolo_id") == veicolo_id:
                    # Vehicle-specific rate
                    tariffe_specifiche.append(t)
                elif t.get("veicolo_id") is None or t.get("veicolo_id") == "" or t.get("veicolo_id") == "tutti":
                    # General rate
                    tariffe_generali.append(t)
        except:
            continue
    
    # Sort by period duration (shortest first = most specific)
    tariffe_specifiche.sort(key=lambda x: x.get("_durata_periodo", 9999))
    tariffe_generali.sort(key=lambda x: x.get("_durata_periodo", 9999))
    
    # Helper function to format date as DD/MM/YYYY
    def format_date_it(date_str):
        try:
            parts = date_str.split("-")
            if len(parts) == 3:
                return f"{parts[2]}/{parts[1]}/{parts[0]}"
        except:
            pass
        return date_str
    
    # Apply priority: vehicle-specific with shortest period first
    if tariffe_specifiche:
        best = tariffe_specifiche[0]
        return {
            "tariffa_giornaliera": best["tariffa_giornaliera"],
            "tariffa_applicata": "stagionale_specifica",
            "nome_tariffa": best["nome"],
            "periodo": f"{format_date_it(best['data_inizio'])} - {format_date_it(best['data_fine'])}"
        }
    elif tariffe_generali:
        best = tariffe_generali[0]
        return {
            "tariffa_giornaliera": best["tariffa_giornaliera"],
            "tariffa_applicata": "stagionale_generale",
            "nome_tariffa": best["nome"],
            "periodo": f"{format_date_it(best['data_inizio'])} - {format_date_it(best['data_fine'])}"
        }
    else:
        return {
            "tariffa_giornaliera": base_price,
            "tariffa_applicata": "base",
            "nome_tariffa": "Tariffa Base Veicolo"
        }

# ========== FILE UPLOAD ==========

import shutil
from pathlib import Path

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), admin: dict = Depends(get_admin_user)):
    """Upload an image file for vehicles"""
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo file non supportato. Usa JPG, PNG, WebP o GIF")
    
    # Generate unique filename
    extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4()}.{extension}"
    filepath = UPLOAD_DIR / filename
    
    # Save file
    try:
        with open(filepath, "wb") as buffer:
            content = await file.read()
            # Validate file size (max 5MB)
            if len(content) > 5 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="File troppo grande. Massimo 5MB")
            buffer.write(content)
        
        # Return the URL to access the file
        image_url = f"/api/uploads/{filename}"
        return {"url": image_url, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore upload: {str(e)}")

@api_router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded files"""
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File non trovato")
    
    # Determine content type
    extension = filename.split('.')[-1].lower()
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif'
    }
    content_type = content_types.get(extension, 'application/octet-stream')
    
    def iterfile():
        with open(filepath, "rb") as f:
            yield from f
    
    return StreamingResponse(iterfile(), media_type=content_type)

# ========== VEHICLES ==========

def normalize_vehicle(v: dict) -> dict:
    """Normalize vehicle data from old schema to new Italian schema"""
    if not v:
        return v
    # Map old English fields to new Italian fields
    field_mapping = {
        "brand": "marca",
        "model": "modello", 
        "license_plate": "targa",
        "daily_rate": "tariffa_giornaliera",
        "fuel_type": "alimentazione",
        "transmission": "cambio",
        "seats": "posti",
        "mileage": "km_attuali",
        "year": "anno",
        "category": "categoria"
    }
    
    status_mapping = {
        "available": "disponibile",
        "rented": "noleggiato",
        "maintenance": "manutenzione"
    }
    
    normalized = {}
    for key, value in v.items():
        if key in field_mapping:
            normalized[field_mapping[key]] = value
        else:
            normalized[key] = value
    
    # Normalize status
    if "status" in normalized and normalized["status"] in status_mapping:
        normalized["status"] = status_mapping[normalized["status"]]
    
    # Add default values for missing Italian fields
    normalized.setdefault("colore", "N/A")
    normalized.setdefault("deposito_cauzionale", 500.0)
    normalized.setdefault("km_inclusi_giorno", 200)
    normalized.setdefault("prezzo_km_extra", 0.25)
    
    return normalized

@api_router.get("/vehicles")
async def get_vehicles(status: Optional[str] = None):
    query = {}
    if status:
        # Support both Italian and English status
        status_variants = [status]
        if status == "disponibile":
            status_variants.append("available")
        elif status == "available":
            status_variants.append("disponibile")
        query["status"] = {"$in": status_variants}
    vehicles = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    return [normalize_vehicle(v) for v in vehicles]

@api_router.get("/vehicles/available")
async def get_available_vehicles():
    vehicles = await db.vehicles.find({"status": {"$in": ["disponibile", "available"]}}, {"_id": 0}).to_list(1000)
    return [normalize_vehicle(v) for v in vehicles]

@api_router.get("/vehicles/disponibili")
async def get_vehicles_disponibili(
    data_inizio: str,
    data_fine: str,
    exclude_booking_id: Optional[str] = None
):
    """
    Get vehicles that are available (not booked) for a specific date range.
    Optionally exclude a specific booking (for edits).
    """
    # Get all vehicles
    all_vehicles = await db.vehicles.find({"status": {"$in": ["disponibile", "available"]}}, {"_id": 0}).to_list(1000)
    
    # Get all bookings that overlap with the requested period
    # Exclude the booking being edited and exclude cancelled/closed bookings
    query = {
        "status": {"$nin": ["annullata", "chiuso"]},
        "$or": [
            # Booking starts during requested period
            {"data_ritiro": {"$gte": data_inizio, "$lte": data_fine}},
            # Booking ends during requested period
            {"data_riconsegna": {"$gte": data_inizio, "$lte": data_fine}},
            # Booking spans the entire requested period
            {"$and": [
                {"data_ritiro": {"$lte": data_inizio}},
                {"data_riconsegna": {"$gte": data_fine}}
            ]}
        ]
    }
    
    if exclude_booking_id:
        query["id"] = {"$ne": exclude_booking_id}
    
    overlapping_bookings = await db.prenotazioni.find(query, {"veicolo_id": 1}).to_list(1000)
    booked_vehicle_ids = set(b.get("veicolo_id") for b in overlapping_bookings if b.get("veicolo_id") and b.get("veicolo_id") != "generico")
    
    # Filter out booked vehicles
    available = [v for v in all_vehicles if v.get("id") not in booked_vehicle_ids]
    
    return [normalize_vehicle(v) for v in available]

@api_router.get("/vehicles/available-period")
async def get_vehicles_available_for_period(
    data_inizio: str, 
    data_fine: str,
    ora_inizio: str = "09:00",
    ora_fine: str = "18:00"
):
    """Get all active vehicles with availability status for a specific period.
    Considers hours when bookings touch on the same day (e.g. return at 09:00 → can rent from 09:00+ same day).
    """
    # Get all active vehicles (any status except maintenance/out-of-service)
    all_vehicles = await db.vehicles.find({"status": {"$nin": ["manutenzione", "fuori_servizio"]}}, {"_id": 0}).to_list(1000)
    
    # Get all candidate bookings that *might* overlap with the requested period (broad date filter)
    query = {
        "status": {"$nin": ["annullata", "chiuso"]},
        "$or": [
            {"data_ritiro": {"$gte": data_inizio, "$lte": data_fine}},
            {"data_riconsegna": {"$gte": data_inizio, "$lte": data_fine}},
            {"$and": [
                {"data_ritiro": {"$lte": data_inizio}},
                {"data_riconsegna": {"$gte": data_fine}}
            ]}
        ]
    }
    
    candidates = await db.prenotazioni.find(query, {"veicolo_id": 1, "data_ritiro": 1, "ora_ritiro": 1, "data_riconsegna": 1, "ora_riconsegna": 1}).to_list(1000)
    
    # Filter with hour-precision: a booking truly overlaps if the datetime intervals intersect
    def to_dt(d, t):
        try:
            return datetime.strptime(f"{d} {t or '00:00'}", "%Y-%m-%d %H:%M")
        except Exception:
            return None
    
    new_start = to_dt(data_inizio, ora_inizio)
    new_end = to_dt(data_fine, ora_fine)
    
    booked_vehicle_ids = set()
    for b in candidates:
        vid = b.get("veicolo_id")
        if not vid or vid == "generico":
            continue
        b_start = to_dt(b.get("data_ritiro"), b.get("ora_ritiro") or "09:00")
        b_end = to_dt(b.get("data_riconsegna"), b.get("ora_riconsegna") or "18:00")
        if not (b_start and b_end and new_start and new_end):
            # If parsing fails fall back to date-only conflict
            booked_vehicle_ids.add(vid)
            continue
        # Add 1-hour buffer after return (vehicle needs to be cleaned/inspected)
        b_end_with_buffer = b_end + timedelta(hours=1)
        # True overlap: existing.start < new.end AND existing.end+1h > new.start
        if b_start < new_end and b_end_with_buffer > new_start:
            booked_vehicle_ids.add(vid)
    
    # Return only available (not booked) vehicles
    available = [v for v in all_vehicles if v.get("id") not in booked_vehicle_ids]
    
    return [normalize_vehicle(v) for v in available]

# ==================== CALENDARIO NOTE ====================

@api_router.get("/calendario/note")
async def get_calendario_note(admin: dict = Depends(get_admin_user)):
    """Get all calendar notes"""
    notes = await db.calendario_note.find({}, {"_id": 0}).to_list(1000)
    return notes

@api_router.post("/calendario/note")
async def create_calendario_nota(data: dict, admin: dict = Depends(get_admin_user)):
    """Create a new calendar note (without client)"""
    nota_id = str(uuid.uuid4())
    nota_doc = {
        "id": nota_id,
        "titolo": data.get("titolo", ""),
        "contenuto": data.get("contenuto", ""),
        "data": data.get("data", ""),
        "colore": data.get("colore", "gray"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("id")
    }
    await db.calendario_note.insert_one(nota_doc)
    return {"id": nota_id, "message": "Nota creata"}

@api_router.delete("/calendario/note/{nota_id}")
async def delete_calendario_nota(nota_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a calendar note"""
    result = await db.calendario_note.delete_one({"id": nota_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nota non trovata")
    return {"message": "Nota eliminata"}

@api_router.put("/calendario/note/{nota_id}")
async def update_calendario_nota(nota_id: str, data: dict, admin: dict = Depends(get_admin_user)):
    """Update an existing calendar note"""
    allowed = {k: v for k, v in data.items() if k in ("titolo", "contenuto", "data", "colore")}
    if not allowed:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    result = await db.calendario_note.update_one({"id": nota_id}, {"$set": allowed})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nota non trovata")
    return {"message": "Nota aggiornata"}

@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    return normalize_vehicle(vehicle)

@api_router.post("/vehicles")
async def create_vehicle(data: VeicoloCreate, admin: dict = Depends(get_admin_user)):
    existing = await db.vehicles.find_one({"targa": data.targa.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Targa già registrata")
    
    vehicle_id = str(uuid.uuid4())
    vehicle_doc = {
        "id": vehicle_id,
        "marca": data.marca,
        "modello": data.modello,
        "targa": data.targa.upper(),
        "colore": data.colore,
        "cambio": data.cambio,
        "alimentazione": data.alimentazione,
        "anno": data.anno,
        "posti": data.posti,
        "km_attuali": data.km_attuali,
        "tariffa_giornaliera": data.tariffa_giornaliera,
        "deposito_cauzionale": data.deposito_cauzionale,
        "km_inclusi_giorno": data.km_inclusi_giorno,
        "prezzo_km_extra": data.prezzo_km_extra,
        "image_url": data.image_url,
        "status": "disponibile",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.vehicles.insert_one(vehicle_doc)
    vehicle_doc.pop("_id", None)
    return vehicle_doc

@api_router.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, data: VeicoloCreate, admin: dict = Depends(get_admin_user)):
    update_dict = data.model_dump()
    update_dict["targa"] = update_dict["targa"].upper()
    result = await db.vehicles.update_one({"id": vehicle_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    return vehicle

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.vehicles.delete_one({"id": vehicle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    return {"message": "Veicolo eliminato"}

@api_router.patch("/vehicles/{vehicle_id}/status")
async def update_vehicle_status(vehicle_id: str, status: str, admin: dict = Depends(get_admin_user)):
    valid_statuses = ["disponibile", "noleggiato", "manutenzione"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Stato non valido. Valori ammessi: {valid_statuses}")
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": {"status": status}})
    return {"message": "Stato aggiornato"}

# ========== FRANCHISES & SERVICES ==========

@api_router.get("/franchigie")
async def get_franchigie():
    franchigie = await db.franchigie.find({}, {"_id": 0}).to_list(100)
    return franchigie

@api_router.post("/franchigie")
async def create_franchigia(data: FranchigiaCreate, admin: dict = Depends(get_admin_user)):
    franchigia_doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.franchigie.insert_one(franchigia_doc)
    franchigia_doc.pop("_id", None)
    return franchigia_doc

@api_router.delete("/franchigie/{franchigia_id}")
async def delete_franchigia(franchigia_id: str, admin: dict = Depends(get_admin_user)):
    await db.franchigie.delete_one({"id": franchigia_id})
    return {"message": "Franchigia eliminata"}

@api_router.put("/franchigie/{franchigia_id}")
async def update_franchigia(franchigia_id: str, data: dict, admin: dict = Depends(get_admin_user)):
    """Update franchigia values"""
    allowed_fields = ["nome", "descrizione", "importo_massimo", "costo_giornaliero", "codice", "percentuale_scoperto"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    if update_data:
        await db.franchigie.update_one({"id": franchigia_id}, {"$set": update_data})
    return {"message": "Franchigia aggiornata"}

@api_router.get("/servizi-supplementari")
async def get_servizi_supplementari():
    servizi = await db.servizi_supplementari.find({}, {"_id": 0}).to_list(100)
    return servizi

@api_router.post("/servizi-supplementari")
async def create_servizio(data: ServizioSupplementareCreate, admin: dict = Depends(get_admin_user)):
    servizio_doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.servizi_supplementari.insert_one(servizio_doc)
    servizio_doc.pop("_id", None)
    return servizio_doc

@api_router.delete("/servizi-supplementari/{servizio_id}")
async def delete_servizio(servizio_id: str, admin: dict = Depends(get_admin_user)):
    await db.servizi_supplementari.delete_one({"id": servizio_id})
    return {"message": "Servizio eliminato"}

@api_router.put("/servizi-supplementari/{servizio_id}")
async def update_servizio(servizio_id: str, data: dict, admin: dict = Depends(get_admin_user)):
    """Update servizio supplementare values"""
    allowed_fields = ["nome", "descrizione", "prezzo_unitario", "unita"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    if update_data:
        await db.servizi_supplementari.update_one({"id": servizio_id}, {"$set": update_data})
    return {"message": "Servizio aggiornato"}

# ========== BOOKINGS / PRENOTAZIONI ==========

@api_router.get("/prenotazioni")
async def get_prenotazioni(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] != "admin":
        query["cliente_id"] = user["id"]
    if status:
        query["status"] = status
    prenotazioni = await db.prenotazioni.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return prenotazioni

@api_router.get("/prenotazioni/{prenotazione_id}")
async def get_prenotazione(prenotazione_id: str, user: dict = Depends(get_current_user)):
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    if user["role"] != "admin" and prenotazione["cliente_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    return prenotazione

@api_router.post("/prenotazioni")
async def create_prenotazione(data: PrenotazioneCreate, user: dict = Depends(get_current_user)):
    # Check vehicle
    vehicle_raw = await db.vehicles.find_one({"id": data.veicolo_id}, {"_id": 0})
    if not vehicle_raw:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    
    # Normalize vehicle data
    vehicle = normalize_vehicle(vehicle_raw)
    
    # Validate additional drivers licenses
    if data.conducenti_aggiuntivi:
        for i, cond in enumerate(data.conducenti_aggiuntivi):
            if is_date_expired(cond.patente_data_scadenza):
                raise HTTPException(status_code=400, detail=f"La patente del conducente aggiuntivo {i+1} risulta scaduta")
    
    # Calculate duration and price
    data_ritiro = datetime.strptime(f"{data.data_ritiro} {data.ora_ritiro}", "%Y-%m-%d %H:%M")
    data_riconsegna = datetime.strptime(f"{data.data_riconsegna} {data.ora_riconsegna}", "%Y-%m-%d %H:%M")
    durata_ore = (data_riconsegna - data_ritiro).total_seconds() / 3600
    durata_giorni = max(1, int(durata_ore / 24) + (1 if durata_ore % 24 > 0 else 0))
    
    tariffa_giornaliera = vehicle["tariffa_giornaliera"]
    tariffa_stagionale_info = None
    
    # Check for seasonal rate
    from datetime import datetime as dt
    try:
        start_date = dt.strptime(data.data_ritiro, "%Y-%m-%d").date()
        end_date = dt.strptime(data.data_riconsegna, "%Y-%m-%d").date()
        tariffe = await db.tariffe_stagionali.find({}, {"_id": 0}).to_list(100)
        
        tariffe_specifiche = []
        tariffe_generali = []
        
        for t in tariffe:
            try:
                t_inizio = dt.strptime(t["data_inizio"], "%Y-%m-%d").date()
                t_fine = dt.strptime(t["data_fine"], "%Y-%m-%d").date()
                if start_date >= t_inizio and start_date <= t_fine:
                    durata_periodo = (t_fine - t_inizio).days
                    t["_durata_periodo"] = durata_periodo
                    if t.get("veicolo_id") == data.veicolo_id:
                        tariffe_specifiche.append(t)
                    elif t.get("veicolo_id") is None or t.get("veicolo_id") == "" or t.get("veicolo_id") == "tutti":
                        tariffe_generali.append(t)
            except:
                continue
        
        tariffe_specifiche.sort(key=lambda x: x.get("_durata_periodo", 9999))
        tariffe_generali.sort(key=lambda x: x.get("_durata_periodo", 9999))
        
        if tariffe_specifiche:
            best = tariffe_specifiche[0]
            tariffa_giornaliera = best["tariffa_giornaliera"]
            tariffa_stagionale_info = {
                "nome": best["nome"],
                "tariffa_giornaliera": best["tariffa_giornaliera"],
                "data_inizio": best["data_inizio"],
                "data_fine": best["data_fine"],
                "tipo": "specifica"
            }
        elif tariffe_generali:
            best = tariffe_generali[0]
            tariffa_giornaliera = best["tariffa_giornaliera"]
            tariffa_stagionale_info = {
                "nome": best["nome"],
                "tariffa_giornaliera": best["tariffa_giornaliera"],
                "data_inizio": best["data_inizio"],
                "data_fine": best["data_fine"],
                "tipo": "generale"
            }
    except Exception as e:
        logger.warning(f"Error checking seasonal rate: {e}")
    
    tariffa_base = durata_giorni * tariffa_giornaliera
    km_inclusi_totali = durata_giorni * vehicle["km_inclusi_giorno"]
    
    prenotazione_id = str(uuid.uuid4())
    prenotazione_doc = {
        "id": prenotazione_id,
        "cliente_id": user["id"],
        "cliente_nome": f"{user['nome']} {user['cognome']}",
        "cliente_email": user["email"],
        "veicolo_id": data.veicolo_id,
        "veicolo_marca": vehicle["marca"],
        "veicolo_modello": vehicle["modello"],
        "veicolo_targa": vehicle["targa"],
        "veicolo_colore": vehicle["colore"],
        "veicolo_cambio": vehicle["cambio"],
        "veicolo_alimentazione": vehicle["alimentazione"],
        "data_ritiro": data.data_ritiro,
        "ora_ritiro": data.ora_ritiro,
        "data_riconsegna": data.data_riconsegna,
        "ora_riconsegna": data.ora_riconsegna,
        "durata_giorni": durata_giorni,
        "tariffa_base": tariffa_base,
        "tariffa_giornaliera": tariffa_giornaliera,
        "tariffa_stagionale": tariffa_stagionale_info,
        "km_inclusi_totali": km_inclusi_totali,
        "prezzo_km_extra": vehicle["prezzo_km_extra"],
        "deposito_cauzionale": vehicle["deposito_cauzionale"],
        "acconto": 0,
        "conducenti_aggiuntivi": [c.model_dump() for c in data.conducenti_aggiuntivi] if data.conducenti_aggiuntivi else [],
        "servizi_supplementari": [],
        "franchigie_selezionate": [],
        "luogo_ritiro": AGENCY_DATA["sede_checkin"]["nome"],
        "indirizzo_ritiro": f"{AGENCY_DATA['sede_checkin']['indirizzo']}, {AGENCY_DATA['sede_checkin']['cap']} {AGENCY_DATA['sede_checkin']['comune']} ({AGENCY_DATA['sede_checkin']['provincia']})",
        "luogo_riconsegna": AGENCY_DATA["sede_checkin"]["nome"],
        "indirizzo_riconsegna": f"{AGENCY_DATA['sede_checkin']['indirizzo']}, {AGENCY_DATA['sede_checkin']['cap']} {AGENCY_DATA['sede_checkin']['comune']} ({AGENCY_DATA['sede_checkin']['provincia']})",
        "note": data.note,
        "status": "bozza",
        "check_in": None,
        "check_out": None,
        "danni_preesistenti": [],
        "garanzia_pagamento": None,
        "totale_servizi": 0,
        "totale_franchigie": 0,
        "totale_noleggio": tariffa_base,
        "totale_addebiti_rientro": 0,
        "contratto_generato": False,
        "contratto_id": None,
        "firma_cliente": None,
        "firma_locatore": None,
        # Credit card from client profile
        "carta_circuito": user.get("carta_credito", {}).get("circuito", "") if user.get("carta_credito") else "",
        "carta_intestatario": user.get("carta_credito", {}).get("intestatario", "") if user.get("carta_credito") else "",
        "carta_numero": user.get("carta_credito", {}).get("numero", "") if user.get("carta_credito") else "",
        "carta_scadenza_mese": user.get("carta_credito", {}).get("scadenza_mese", "") if user.get("carta_credito") else "",
        "carta_scadenza_anno": user.get("carta_credito", {}).get("scadenza_anno", "") if user.get("carta_credito") else "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.prenotazioni.insert_one(prenotazione_doc)
    
    # Remove _id before returning (MongoDB adds it in-place)
    prenotazione_doc.pop("_id", None)
    
    # Log operation
    await db.logs.insert_one({
        "tipo": "prenotazione_creata",
        "prenotazione_id": prenotazione_id,
        "user_id": user["id"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return prenotazione_doc

@api_router.patch("/prenotazioni/{prenotazione_id}/status")
async def update_prenotazione_status(prenotazione_id: str, status: str, admin: dict = Depends(get_admin_user)):
    valid_statuses = ["bozza", "in_verifica", "approvata", "contratto_generato", "consegnato", "chiuso", "annullata"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Stato non valido. Valori ammessi: {valid_statuses}")
    
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    # Update vehicle status based on booking status
    if status == "consegnato":
        await db.vehicles.update_one({"id": prenotazione["veicolo_id"]}, {"$set": {"status": "noleggiato"}})
    elif status in ["chiuso", "annullata"]:
        await db.vehicles.update_one({"id": prenotazione["veicolo_id"]}, {"$set": {"status": "disponibile"}})
    
    # Prepare update data
    update_data = {"status": status}
    
    # If status is "contratto_generato", also set the flag
    if status == "contratto_generato":
        update_data["contratto_generato"] = True
    
    await db.prenotazioni.update_one({"id": prenotazione_id}, {"$set": update_data})
    
    # Send confirmation email when booking is approved
    email_sent = False
    if status == "approvata":
        cliente = await db.users.find_one({"id": prenotazione["cliente_id"]}, {"_id": 0})
        if cliente:
            cliente_nome = f"{cliente.get('nome', '')} {cliente.get('cognome', '')}"
            email_sent = await send_booking_confirmation_email(
                cliente.get("email"),
                cliente_nome,
                prenotazione
            )
    
    # Log
    await db.logs.insert_one({
        "tipo": "cambio_stato_prenotazione",
        "prenotazione_id": prenotazione_id,
        "nuovo_stato": status,
        "admin_id": admin["id"],
        "email_inviata": email_sent if status == "approvata" else None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    response_msg = f"Stato aggiornato a {status}"
    if status == "approvata":
        response_msg += ". Email di conferma inviata al cliente." if email_sent else ". Email non configurata."
    
    return {"message": response_msg}

@api_router.delete("/prenotazioni/{prenotazione_id}")
async def delete_prenotazione(prenotazione_id: str, admin: dict = Depends(get_admin_user)):
    """Delete any booking permanently - vehicle becomes available again"""
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    # Delete the booking (any status allowed)
    await db.prenotazioni.delete_one({"id": prenotazione_id})
    
    # Log
    await db.logs.insert_one({
        "tipo": "eliminazione_prenotazione",
        "prenotazione_id": prenotazione_id,
        "admin_id": admin["id"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Prenotazione eliminata definitivamente"}

# =============== ADMIN CREATE BOOKING ===============
@api_router.post("/prenotazioni/admin-create")
async def admin_create_prenotazione(data: dict, admin: dict = Depends(get_admin_user)):
    """Admin creates a booking directly - can also create for new or existing client or calendar block"""
    
    user_id = data.get("user_id")
    veicolo_id = data.get("veicolo_id")
    is_veicolo_generico = data.get("is_veicolo_generico", False) or veicolo_id == "generico"
    is_blocco_calendario = user_id == "BLOCCO_CALENDARIO"
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id è obbligatorio")
    if not veicolo_id:
        raise HTTPException(status_code=400, detail="veicolo_id è obbligatorio")
    
    data_ritiro = data.get("data_ritiro")
    data_riconsegna = data.get("data_riconsegna")
    
    # Check vehicle availability for the period (if not generic vehicle)
    if not is_veicolo_generico and veicolo_id != "generico":
        conflicting = await db.prenotazioni.find_one({
            "veicolo_id": veicolo_id,
            "status": {"$nin": ["annullata", "chiuso"]},
            "$or": [
                {"data_ritiro": {"$gte": data_ritiro, "$lte": data_riconsegna}},
                {"data_riconsegna": {"$gte": data_ritiro, "$lte": data_riconsegna}},
                {"$and": [
                    {"data_ritiro": {"$lte": data_ritiro}},
                    {"data_riconsegna": {"$gte": data_riconsegna}}
                ]}
            ]
        })
        if conflicting:
            raise HTTPException(
                status_code=400, 
                detail=f"Veicolo già prenotato per il periodo {data_ritiro} - {data_riconsegna}. Scegli un altro veicolo o un altro periodo."
            )
    
    # Get client info (or set placeholder for calendar block)
    if is_blocco_calendario:
        cliente = {
            "id": "BLOCCO_CALENDARIO",
            "nome": "BLOCCO",
            "cognome": "CALENDARIO",
            "email": "",
            "cellulare": ""
        }
    else:
        cliente = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    
    # Handle generic vehicle vs specific vehicle
    if is_veicolo_generico:
        # Veicolo generico - da assegnare al ritiro
        veicolo_marca = "GENERICO"
        veicolo_modello = "Da assegnare"
        veicolo_targa = "---"
        veicolo_colore = ""
        veicolo_cambio = ""
        veicolo_alimentazione = ""
        tariffa_giornaliera = 50  # Tariffa default
        km_inclusi_giorno = 200
        prezzo_km_extra = 0.20
        deposito_cauzionale = 500
    else:
        # Get specific vehicle info
        veicolo_raw = await db.vehicles.find_one({"id": veicolo_id}, {"_id": 0})
        if not veicolo_raw:
            raise HTTPException(status_code=404, detail="Veicolo non trovato")
        veicolo = normalize_vehicle(veicolo_raw)
        veicolo_marca = veicolo["marca"]
        veicolo_modello = veicolo["modello"]
        veicolo_targa = veicolo["targa"]
        veicolo_colore = veicolo.get("colore", "")
        veicolo_cambio = veicolo.get("cambio", "")
        veicolo_alimentazione = veicolo.get("alimentazione", "")
        tariffa_giornaliera = veicolo.get("tariffa_giornaliera", 50)
        km_inclusi_giorno = veicolo.get("km_inclusi_giorno", 200)
        prezzo_km_extra = veicolo.get("prezzo_km_extra", 0.20)
        deposito_cauzionale = veicolo.get("deposito_cauzionale", 500)
    
    # Check vehicle availability for the requested period (hour-precision)
    if not is_blocco_calendario:
        data_ritiro = data.get('data_ritiro')
        data_riconsegna = data.get('data_riconsegna')
        ora_ritiro = data.get('ora_ritiro', '09:00')
        ora_riconsegna = data.get('ora_riconsegna', '18:00')
        if data_ritiro and data_riconsegna:
            # Find date-overlapping bookings, then check hours
            candidates = await db.prenotazioni.find({
                "veicolo_id": veicolo_id,
                "status": {"$nin": ["annullata", "chiuso"]},
                "data_ritiro": {"$lte": data_riconsegna},
                "data_riconsegna": {"$gte": data_ritiro}
            }).to_list(100)
            
            try:
                new_start = datetime.strptime(f"{data_ritiro} {ora_ritiro}", "%Y-%m-%d %H:%M")
                new_end = datetime.strptime(f"{data_riconsegna} {ora_riconsegna}", "%Y-%m-%d %H:%M")
                conflict = None
                for c in candidates:
                    try:
                        c_start = datetime.strptime(f"{c.get('data_ritiro')} {c.get('ora_ritiro') or '09:00'}", "%Y-%m-%d %H:%M")
                        c_end = datetime.strptime(f"{c.get('data_riconsegna')} {c.get('ora_riconsegna') or '18:00'}", "%Y-%m-%d %H:%M")
                    except Exception:
                        conflict = c
                        break
                    # 1-hour buffer after return
                    c_end_buf = c_end + timedelta(hours=1)
                    if c_start < new_end and c_end_buf > new_start:
                        conflict = c
                        break
            except Exception:
                conflict = candidates[0] if candidates else None
            
            if conflict:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Veicolo già prenotato dal {conflict.get('data_ritiro')} {conflict.get('ora_ritiro','')} al {conflict.get('data_riconsegna')} {conflict.get('ora_riconsegna','')} (Cliente: {conflict.get('cliente_nome', 'N/A')})"
                )
    
    # Calculate duration based on actual hours (1 day = 24h, any excess = +1 day)
    try:
        dt_ritiro = datetime.strptime(f"{data.get('data_ritiro')} {data.get('ora_ritiro', '09:00')}", "%Y-%m-%d %H:%M")
        dt_riconsegna = datetime.strptime(f"{data.get('data_riconsegna')} {data.get('ora_riconsegna', '18:00')}", "%Y-%m-%d %H:%M")
        durata_ore = (dt_riconsegna - dt_ritiro).total_seconds() / 3600
        durata = max(1, int(durata_ore / 24) + (1 if durata_ore % 24 > 0 else 0))
    except:
        durata = data.get("durata_giorni", 1)
    
    # Check for seasonal rate
    tariffa_stagionale_info = None
    if not is_blocco_calendario:
        try:
            from datetime import datetime as dt
            start_date = dt.strptime(data.get('data_ritiro'), "%Y-%m-%d").date()
            end_date = dt.strptime(data.get('data_riconsegna'), "%Y-%m-%d").date()
            tariffe = await db.tariffe_stagionali.find({}, {"_id": 0}).to_list(100)
            
            tariffe_specifiche = []
            tariffe_generali = []
            
            for t in tariffe:
                try:
                    t_inizio = dt.strptime(t["data_inizio"], "%Y-%m-%d").date()
                    t_fine = dt.strptime(t["data_fine"], "%Y-%m-%d").date()
                    if start_date >= t_inizio and start_date <= t_fine:
                        if t.get("veicolo_id") == veicolo_id:
                            tariffe_specifiche.append(t)
                        elif t.get("veicolo_id") is None or t.get("veicolo_id") == "" or t.get("veicolo_id") == "tutti":
                            tariffe_generali.append(t)
                except:
                    continue
            
            best = None
            if tariffe_specifiche:
                best = tariffe_specifiche[0]
            elif tariffe_generali:
                best = tariffe_generali[0]
            
            if best:
                tariffa_giornaliera = best["tariffa_giornaliera"]
                tariffa_stagionale_info = {
                    "nome": best["nome"],
                    "tariffa_giornaliera": best["tariffa_giornaliera"],
                    "data_inizio": best["data_inizio"],
                    "data_fine": best["data_fine"],
                    "tipo": "specifica" if tariffe_specifiche else "generale"
                }
        except Exception as e:
            logger.warning(f"Error checking seasonal rate in admin-create: {e}")
    
    tariffa_base = tariffa_giornaliera * durata
    km_inclusi = km_inclusi_giorno * durata
    
    prenotazione_id = str(uuid.uuid4())
    
    prenotazione_doc = {
        "id": prenotazione_id,
        "cliente_id": user_id,
        "cliente_nome": f"{cliente.get('nome', '')} {cliente.get('cognome', '')}",
        "veicolo_id": veicolo_id if not is_veicolo_generico else None,
        "is_veicolo_generico": is_veicolo_generico,
        "veicolo_marca": veicolo_marca,
        "veicolo_modello": veicolo_modello,
        "veicolo_targa": veicolo_targa,
        "veicolo_colore": veicolo_colore,
        "veicolo_cambio": veicolo_cambio,
        "veicolo_alimentazione": veicolo_alimentazione,
        "data_ritiro": data.get("data_ritiro"),
        "ora_ritiro": data.get("ora_ritiro", "09:00"),
        "data_riconsegna": data.get("data_riconsegna"),
        "ora_riconsegna": data.get("ora_riconsegna", "18:00"),
        "durata_giorni": durata,
        "luogo_ritiro": "Sede",
        "indirizzo_ritiro": "Corso Umberto, 220 - Soverato (CZ)",
        "luogo_riconsegna": "Sede",
        "indirizzo_riconsegna": "Corso Umberto, 220 - Soverato (CZ)",
        "tariffa_giornaliera": tariffa_giornaliera,
        "tariffa_stagionale": tariffa_stagionale_info,
        "tariffa_base": tariffa_base,
        "km_inclusi_giorno": km_inclusi_giorno,
        "km_inclusi_totali": km_inclusi,
        "prezzo_km_extra": prezzo_km_extra,
        "deposito_cauzionale": deposito_cauzionale,
        "servizi_supplementari": [],
        "totale_servizi": 0,
        "franchigie_selezionate": [],
        "totale_franchigie": 0,
        "totale_noleggio": tariffa_base,
        "acconto": 0,
        "status": data.get("status", "approvata"),
        "contratto_generato": False,
        # Credit card data - load from client profile if not provided
        "carta_circuito": data.get("carta_circuito") or (cliente.get("carta_credito", {}).get("circuito", "") if not is_blocco_calendario else ""),
        "carta_intestatario": data.get("carta_intestatario") or (cliente.get("carta_credito", {}).get("intestatario", "") if not is_blocco_calendario else ""),
        "carta_numero": data.get("carta_numero") or (cliente.get("carta_credito", {}).get("numero", "") if not is_blocco_calendario else ""),
        "carta_scadenza_mese": data.get("carta_scadenza_mese") or (cliente.get("carta_credito", {}).get("scadenza_mese", "") if not is_blocco_calendario else ""),
        "carta_scadenza_anno": data.get("carta_scadenza_anno") or (cliente.get("carta_credito", {}).get("scadenza_anno", "") if not is_blocco_calendario else ""),
        # Note admin e km tipo
        "note_admin": data.get("note_admin", ""),
        "km_tipo": data.get("km_inclusi", "standard"),  # 'standard' o 'illimitati'
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by_admin": admin["id"]
    }
    
    # Se km illimitati, aggiorna i campi
    if data.get("km_inclusi") == "illimitati":
        prenotazione_doc["km_inclusi_totali"] = "ILLIMITATI"
        prenotazione_doc["prezzo_km_extra"] = 0
    
    await db.prenotazioni.insert_one(prenotazione_doc)
    prenotazione_doc.pop("_id", None)
    
    # Save credit card to client profile if provided and client doesn't have it
    if not is_blocco_calendario and user_id != 'BLOCCO_CALENDARIO':
        carta_from_booking = {
            "circuito": data.get("carta_circuito", ""),
            "intestatario": data.get("carta_intestatario", ""),
            "numero": data.get("carta_numero", ""),
            "scadenza_mese": data.get("carta_scadenza_mese", ""),
            "scadenza_anno": data.get("carta_scadenza_anno", "")
        }
        # Save if any card data was provided
        if any(v for v in carta_from_booking.values() if v):
            existing_carta = cliente.get("carta_credito", {})
            # Update if client has no card or card data is empty
            if not existing_carta or not any(v for v in existing_carta.values() if v):
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"carta_credito": carta_from_booking}}
                )
                logger.info(f"Credit card saved to client profile {user_id}")
            else:
                # Always update with latest card data
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"carta_credito": carta_from_booking}}
                )
    
    # Log
    await db.logs.insert_one({
        "tipo": "prenotazione_admin_creata",
        "prenotazione_id": prenotazione_id,
        "cliente_id": user_id,
        "admin_id": admin["id"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return prenotazione_doc

@api_router.put("/prenotazioni/{prenotazione_id}/admin-update")
async def admin_update_prenotazione(prenotazione_id: str, data: dict, admin: dict = Depends(get_admin_user)):
    """Admin can update ALL booking/contract details - FULL DIGITAL EDITING"""
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    allowed_fields = [
        # Servizi e franchigie
        "servizi_supplementari", "franchigie_selezionate", "conducenti_aggiuntivi",
        # Luoghi
        "luogo_ritiro", "indirizzo_ritiro", "luogo_riconsegna", "indirizzo_riconsegna",
        # Date e orari
        "data_ritiro", "ora_ritiro", "data_riconsegna", "ora_riconsegna", "durata_giorni",
        # Veicolo - TUTTI i campi
        "veicolo_id", "veicolo_marca", "veicolo_modello", "veicolo_targa",
        "veicolo_colore", "veicolo_cambio", "veicolo_alimentazione",
        # Chilometraggio
        "km_uscita", "km_inclusi_totali", "prezzo_km_extra", "tacche_carburante_uscita",
        # Costi - TUTTI i campi
        "tariffa_base", "tariffa_giornaliera", "tariffa_stagionale",
        "totale_servizi", "totale_franchigie", "totale_noleggio",
        "acconto", "deposito_cauzionale",
        # Check-in/Check-out
        "contratto_check_in", "contratto_check_out",
        # Danni e note
        "danni_preesistenti", "note",
        # Garanzia pagamento
        "garanzia_pagamento",
        # Dati cliente per contratto (override dei dati anagrafici nel PDF)
        "cliente_dati_contratto",
        # CARTA DI CREDITO - Nuovi campi
        "carta_circuito", "carta_intestatario", "carta_numero",
        "carta_scadenza_mese", "carta_scadenza_anno",
        # GARANTE
        "garante_nome", "garante_recapiti", "garante_documento",
        # METODO PAGAMENTO
        "pagamento_contanti", "pagamento_carta", "pagamento_bonifico",
        "pagamento_altro", "pagamento_altro_desc",
        # Status
        "status",
        # Rientro
        "rientro_data", "rientro_ora", "rientro_km_entrata", "rientro_km_percorsi",
        "rientro_km_eccedenza", "rientro_importo_km_eccedenza", "rientro_tacche_carburante",
        # Addebiti rientro
        "addebito_danni", "addebito_gestione_danni", "addebito_carburante",
        "addebito_pulizia", "addebito_altro", "totale_addebiti_rientro",
        # Franchigie incluse/escluse
        "franchigia_kasko", "franchigia_sinistro", "scoperto_furto",
        "franchigia_kasko_inclusa", "franchigia_sinistro_inclusa",
        # Cliente (per assegnare cliente a un blocco)
        "cliente_id", "cliente_nome", "cliente_email", "cliente_cellulare"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    # Determine effective vehicle and dates for conflict check
    effective_veicolo_id = update_data.get("veicolo_id", prenotazione.get("veicolo_id"))
    effective_data_ritiro = update_data.get("data_ritiro", prenotazione.get("data_ritiro"))
    effective_data_riconsegna = update_data.get("data_riconsegna", prenotazione.get("data_riconsegna"))
    effective_ora_ritiro = update_data.get("ora_ritiro", prenotazione.get("ora_ritiro") or "09:00")
    effective_ora_riconsegna = update_data.get("ora_riconsegna", prenotazione.get("ora_riconsegna") or "18:00")
    
    # Conflict check whenever vehicle OR dates OR hours are changed
    dates_changed = "data_ritiro" in update_data or "data_riconsegna" in update_data
    hours_changed = "ora_ritiro" in update_data or "ora_riconsegna" in update_data
    vehicle_changed = "veicolo_id" in update_data and update_data["veicolo_id"] != prenotazione.get("veicolo_id")
    
    if (dates_changed or hours_changed or vehicle_changed) and effective_veicolo_id and effective_veicolo_id != "generico" and effective_data_ritiro and effective_data_riconsegna:
        # Find date-overlapping candidates, then check hours
        candidates = await db.prenotazioni.find({
            "id": {"$ne": prenotazione_id},
            "veicolo_id": effective_veicolo_id,
            "status": {"$nin": ["annullata", "chiuso"]},
            "data_ritiro": {"$lte": effective_data_riconsegna},
            "data_riconsegna": {"$gte": effective_data_ritiro}
        }).to_list(100)
        
        conflict = None
        try:
            new_start = datetime.strptime(f"{effective_data_ritiro} {effective_ora_ritiro}", "%Y-%m-%d %H:%M")
            new_end = datetime.strptime(f"{effective_data_riconsegna} {effective_ora_riconsegna}", "%Y-%m-%d %H:%M")
            for c in candidates:
                try:
                    c_start = datetime.strptime(f"{c.get('data_ritiro')} {c.get('ora_ritiro') or '09:00'}", "%Y-%m-%d %H:%M")
                    c_end = datetime.strptime(f"{c.get('data_riconsegna')} {c.get('ora_riconsegna') or '18:00'}", "%Y-%m-%d %H:%M")
                except Exception:
                    conflict = c
                    break
                # 1-hour buffer after return
                c_end_buf = c_end + timedelta(hours=1)
                if c_start < new_end and c_end_buf > new_start:
                    conflict = c
                    break
        except Exception:
            conflict = candidates[0] if candidates else None
        
        if conflict:
            raise HTTPException(
                status_code=400, 
                detail=f"Veicolo già prenotato dal {conflict.get('data_ritiro')} {conflict.get('ora_ritiro','')} al {conflict.get('data_riconsegna')} {conflict.get('ora_riconsegna','')} (Cliente: {conflict.get('cliente_nome', 'N/A')}). Il veicolo è disponibile dopo l'orario di riconsegna del noleggio precedente."
            )
    
    # If vehicle changed by ID, update vehicle data
    if vehicle_changed:
        new_veicolo_id = update_data["veicolo_id"]
        new_vehicle_raw = await db.vehicles.find_one({"id": new_veicolo_id}, {"_id": 0})
        if new_vehicle_raw:
            new_vehicle = normalize_vehicle(new_vehicle_raw)
            update_data["veicolo_marca"] = new_vehicle["marca"]
            update_data["veicolo_modello"] = new_vehicle["modello"]
            update_data["veicolo_targa"] = new_vehicle["targa"]
            update_data["veicolo_colore"] = new_vehicle["colore"]
            update_data["veicolo_cambio"] = new_vehicle["cambio"]
            update_data["veicolo_alimentazione"] = new_vehicle["alimentazione"]
    
    if update_data:
        await db.prenotazioni.update_one({"id": prenotazione_id}, {"$set": update_data})
    
    updated = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    return updated

@api_router.post("/prenotazioni/{prenotazione_id}/check-in")
async def register_check_in(prenotazione_id: str, data: CheckInData, admin: dict = Depends(get_admin_user)):
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    check_in_data = {
        "km_uscita": data.km_uscita,
        "tacche_carburante": data.tacche_carburante,
        "luogo_ritiro": data.luogo_ritiro or prenotazione["luogo_ritiro"],
        "indirizzo_ritiro": data.indirizzo_ritiro or prenotazione["indirizzo_ritiro"],
        "data_ora_effettivo": datetime.now(timezone.utc).isoformat(),
        "note": data.note,
        "registrato_da": admin["id"]
    }
    
    await db.prenotazioni.update_one(
        {"id": prenotazione_id},
        {
            "$set": {
                "check_in": check_in_data,
                "danni_preesistenti": data.danni_preesistenti or [],
                "status": "consegnato"
            }
        }
    )
    
    # Update vehicle
    await db.vehicles.update_one(
        {"id": prenotazione["veicolo_id"]},
        {"$set": {"status": "noleggiato", "km_attuali": data.km_uscita}}
    )
    
    return {"message": "Check-in registrato"}

@api_router.post("/prenotazioni/{prenotazione_id}/check-out")
async def register_check_out(prenotazione_id: str, data: CheckOutData, admin: dict = Depends(get_admin_user)):
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    if not prenotazione.get("check_in"):
        raise HTTPException(status_code=400, detail="Check-in non ancora effettuato")
    
    km_percorsi = data.km_entrata - prenotazione["check_in"]["km_uscita"]
    # Handle unlimited km case
    km_inclusi_val = prenotazione.get("km_inclusi_totali")
    km_tipo = prenotazione.get("km_tipo")
    if km_tipo == "illimitati" or km_inclusi_val == "ILLIMITATI" or isinstance(km_inclusi_val, str):
        km_eccedenza = 0
        importo_km_eccedenza = 0
    else:
        km_eccedenza = max(0, km_percorsi - (km_inclusi_val or 0))
        importo_km_eccedenza = km_eccedenza * (prenotazione.get("prezzo_km_extra") or 0)
    
    totale_addebiti = (
        data.danni_veicolo +
        data.costo_gestione_danni +
        data.carburante_mancante +
        data.pulizia_straordinaria +
        data.altri_addebiti +
        importo_km_eccedenza
    )
    
    check_out_data = {
        "data_ora_rientro": data.data_ora_rientro,
        "km_entrata": data.km_entrata,
        "km_percorsi": km_percorsi,
        "km_eccedenza": km_eccedenza,
        "importo_km_eccedenza": importo_km_eccedenza,
        "tacche_carburante_entrata": data.tacche_carburante_entrata,
        "danni_veicolo": data.danni_veicolo,
        "costo_gestione_danni": data.costo_gestione_danni,
        "carburante_mancante": data.carburante_mancante,
        "pulizia_straordinaria": data.pulizia_straordinaria,
        "altri_addebiti": data.altri_addebiti,
        "note_addebiti": data.note_addebiti,
        "totale_addebiti": totale_addebiti,
        "registrato_da": admin["id"],
        "registrato_il": datetime.now(timezone.utc).isoformat()
    }
    
    await db.prenotazioni.update_one(
        {"id": prenotazione_id},
        {
            "$set": {
                "check_out": check_out_data,
                "totale_addebiti_rientro": totale_addebiti,
                "status": "chiuso"
            }
        }
    )
    
    # Update vehicle
    await db.vehicles.update_one(
        {"id": prenotazione["veicolo_id"]},
        {"$set": {"status": "disponibile", "km_attuali": data.km_entrata}}
    )
    
    return {"message": "Check-out registrato", "totale_addebiti": totale_addebiti}

@api_router.post("/prenotazioni/{prenotazione_id}/firma")
async def save_firma(prenotazione_id: str, tipo: str, firma_base64: str, user: dict = Depends(get_current_user)):
    """Save digital signature (base64 image)"""
    if tipo not in ["cliente", "locatore"]:
        raise HTTPException(status_code=400, detail="Tipo firma non valido")
    
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    field = f"firma_{tipo}"
    await db.prenotazioni.update_one(
        {"id": prenotazione_id},
        {"$set": {field: firma_base64}}
    )
    
    return {"message": f"Firma {tipo} salvata"}

# ========== CLIENT SELF-SERVICE ENDPOINTS ==========

@api_router.put("/prenotazioni/{prenotazione_id}/cliente-update")
async def cliente_update_prenotazione(prenotazione_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Client can update their own FUTURE booking"""
    from datetime import datetime as dt
    
    # Get booking
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    # Verify ownership
    if prenotazione.get("cliente_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato a modificare questa prenotazione")
    
    # Check if booking is in the future and editable
    today = dt.now().strftime("%Y-%m-%d")
    if prenotazione.get("data_ritiro", "") < today:
        raise HTTPException(status_code=400, detail="Non puoi modificare prenotazioni passate")
    
    if prenotazione.get("status") in ["consegnato", "chiuso", "annullata"]:
        raise HTTPException(status_code=400, detail="Non puoi modificare questa prenotazione (già in corso o chiusa)")
    
    # Allowed fields for client to update
    update_data = {}
    allowed_fields = [
        "data_ritiro", "data_riconsegna", "ora_ritiro", "ora_riconsegna",
        "luogo_ritiro", "luogo_riconsegna", "note_cliente"
    ]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    # Handle vehicle change
    if "veicolo_id" in data and data["veicolo_id"] != prenotazione.get("veicolo_id"):
        new_vehicle_id = data["veicolo_id"]
        
        # Verify vehicle is available
        new_data_ritiro = data.get("data_ritiro", prenotazione.get("data_ritiro"))
        new_data_riconsegna = data.get("data_riconsegna", prenotazione.get("data_riconsegna"))
        
        # Check for conflicts
        conflict = await db.prenotazioni.find_one({
            "id": {"$ne": prenotazione_id},
            "veicolo_id": new_vehicle_id,
            "status": {"$nin": ["annullata", "chiuso"]},
            "$or": [
                {"data_ritiro": {"$gte": new_data_ritiro, "$lte": new_data_riconsegna}},
                {"data_riconsegna": {"$gte": new_data_ritiro, "$lte": new_data_riconsegna}},
                {"$and": [
                    {"data_ritiro": {"$lte": new_data_ritiro}},
                    {"data_riconsegna": {"$gte": new_data_riconsegna}}
                ]}
            ]
        })
        
        if conflict:
            raise HTTPException(status_code=400, detail="Il veicolo selezionato non è disponibile per queste date")
        
        # Get new vehicle details
        new_vehicle = await db.vehicles.find_one({"id": new_vehicle_id}, {"_id": 0})
        if not new_vehicle:
            raise HTTPException(status_code=400, detail="Veicolo non trovato")
        
        update_data["veicolo_id"] = new_vehicle_id
        update_data["veicolo_marca"] = new_vehicle.get("marca", "")
        update_data["veicolo_modello"] = new_vehicle.get("modello", "")
        update_data["veicolo_targa"] = new_vehicle.get("targa", "")
        
        # Recalculate price
        tariffa_giornaliera = new_vehicle.get("tariffa_giornaliera", new_vehicle.get("base_price", 50))
        try:
            d1 = dt.strptime(new_data_ritiro, "%Y-%m-%d")
            d2 = dt.strptime(new_data_riconsegna, "%Y-%m-%d")
            giorni = max(1, (d2 - d1).days)
            update_data["durata_giorni"] = giorni
            update_data["tariffa_base"] = tariffa_giornaliera * giorni
        except:
            pass
    
    # Recalculate days if dates changed
    if ("data_ritiro" in update_data or "data_riconsegna" in update_data) and "veicolo_id" not in data:
        try:
            d1 = dt.strptime(update_data.get("data_ritiro", prenotazione.get("data_ritiro")), "%Y-%m-%d")
            d2 = dt.strptime(update_data.get("data_riconsegna", prenotazione.get("data_riconsegna")), "%Y-%m-%d")
            giorni = max(1, (d2 - d1).days)
            
            # Get current vehicle price
            current_vehicle = await db.vehicles.find_one({"id": prenotazione.get("veicolo_id")}, {"_id": 0})
            if current_vehicle:
                tariffa = current_vehicle.get("tariffa_giornaliera", current_vehicle.get("base_price", 50))
                update_data["durata_giorni"] = giorni
                update_data["tariffa_base"] = tariffa * giorni
        except:
            pass
    
    update_data["modificato_da_cliente"] = True
    update_data["ultima_modifica_cliente"] = datetime.now(timezone.utc).isoformat()
    
    await db.prenotazioni.update_one(
        {"id": prenotazione_id},
        {"$set": update_data}
    )
    
    return {"message": "Prenotazione modificata con successo"}

@api_router.put("/prenotazioni/{prenotazione_id}/cliente-annulla")
async def cliente_annulla_prenotazione(prenotazione_id: str, user: dict = Depends(get_current_user)):
    """Client can cancel their own FUTURE booking"""
    from datetime import datetime as dt
    
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    # Verify ownership
    if prenotazione.get("cliente_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    # Check if booking is in the future
    today = dt.now().strftime("%Y-%m-%d")
    if prenotazione.get("data_ritiro", "") < today:
        raise HTTPException(status_code=400, detail="Non puoi annullare prenotazioni passate")
    
    if prenotazione.get("status") in ["consegnato", "chiuso", "annullata"]:
        raise HTTPException(status_code=400, detail="Non puoi annullare questa prenotazione")
    
    await db.prenotazioni.update_one(
        {"id": prenotazione_id},
        {
            "$set": {
                "status": "annullata",
                "annullato_da_cliente": True,
                "annullamento_data": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Prenotazione annullata"}

# ========== CLIENTS ==========

@api_router.get("/clienti")
async def get_clienti(admin: dict = Depends(get_admin_user)):
    # Include password_chiaro for admin view, exclude hashed password
    # Exclude deleted clients (status != 'eliminato')
    clienti = await db.users.find(
        {"role": "client", "status": {"$ne": "eliminato"}}, 
        {"_id": 0, "password": 0}
    ).to_list(1000)
    # Ensure password_chiaro is visible to admin
    return clienti

@api_router.get("/clienti/{cliente_id}")
async def get_cliente(cliente_id: str, admin: dict = Depends(get_admin_user)):
    cliente = await db.users.find_one({"id": cliente_id, "role": "client"}, {"_id": 0, "password": 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return cliente

@api_router.get("/clienti/{cliente_id}/storico-noleggi")
async def get_storico_noleggi_cliente(cliente_id: str, admin: dict = Depends(get_admin_user)):
    """Get rental history for a specific client"""
    # Verify client exists
    cliente = await db.users.find_one({"id": cliente_id, "role": "client"}, {"_id": 0, "password": 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    
    # Get all bookings for this client
    prenotazioni = await db.prenotazioni.find(
        {"cliente_id": cliente_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Calculate statistics
    totale_noleggi = len(prenotazioni)
    noleggi_completati = len([p for p in prenotazioni if p.get("status") == "chiuso"])
    noleggi_attivi = len([p for p in prenotazioni if p.get("status") in ["consegnato", "approvata", "contratto_generato"]])
    totale_speso = sum(p.get("tariffa_base", 0) + p.get("totale_addebiti_rientro", 0) for p in prenotazioni if p.get("status") == "chiuso")
    
    return {
        "cliente": cliente,
        "statistiche": {
            "totale_noleggi": totale_noleggi,
            "noleggi_completati": noleggi_completati,
            "noleggi_attivi": noleggi_attivi,
            "totale_speso": totale_speso
        },
        "prenotazioni": prenotazioni
    }

@api_router.post("/clienti/admin-create")
async def admin_create_cliente(data: dict, admin: dict = Depends(get_admin_user)):
    """Admin creates a new client directly"""
    # Validate required fields
    required = ["nome", "cognome", "email", "password"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Campo obbligatorio mancante: {field}")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data["email"].lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Create user
    user_id = str(uuid.uuid4())
    
    # Prepare carta_credito data
    carta_credito = data.get("carta_credito", {})
    
    user = {
        "id": user_id,
        "email": data["email"].lower(),
        "password": hash_password(data["password"]),
        "password_chiaro": data["password"],  # Store in clear for admin view
        "nome": data.get("nome", ""),
        "cognome": data.get("cognome", ""),
        "data_nascita": data.get("data_nascita", ""),
        "luogo_nascita": data.get("luogo_nascita", ""),
        "codice_fiscale": data.get("codice_fiscale", "").upper(),
        "indirizzo": data.get("indirizzo", ""),
        "comune": data.get("comune", ""),
        "provincia": data.get("provincia", "").upper(),
        "cap": data.get("cap", ""),
        "stato": data.get("stato", "Italia"),
        "cellulare": data.get("cellulare", ""),
        "patente": data.get("patente", {}),
        "documento_identita": data.get("documento_identita", {}),
        # Carta di credito (opzionale)
        "carta_credito": {
            "circuito": carta_credito.get("circuito", ""),
            "intestatario": carta_credito.get("intestatario", ""),
            "numero": carta_credito.get("numero", ""),
            "scadenza_mese": carta_credito.get("scadenza_mese", ""),
            "scadenza_anno": carta_credito.get("scadenza_anno", "")
        },
        "role": "client",
        "status": "attivo",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by_admin": admin["id"]
    }
    
    await db.users.insert_one(user)
    
    # Return without _id and password hash
    user.pop("_id", None)
    user.pop("password", None)
    
    return {"message": "Cliente creato con successo", "cliente": user}

@api_router.put("/clienti/{cliente_id}")
async def update_cliente(cliente_id: str, data: dict, admin: dict = Depends(get_admin_user)):
    """Admin can update client data including password and credit card"""
    allowed_fields = [
        "nome", "cognome", "data_nascita", "luogo_nascita", "codice_fiscale",
        "indirizzo", "comune", "provincia", "cap", "stato", "cellulare",
        "patente", "password_chiaro", "carta_credito", "documento_identita"
    ]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    # If password_chiaro is being set, also update the hashed password
    if "password_chiaro" in update_data and update_data["password_chiaro"]:
        update_data["password"] = hash_password(update_data["password_chiaro"])
    
    if update_data:
        await db.users.update_one({"id": cliente_id}, {"$set": update_data})
    
    return {"message": "Cliente aggiornato"}

@api_router.delete("/clienti/{cliente_id}")
async def delete_cliente(cliente_id: str, admin: dict = Depends(get_admin_user)):
    """
    Delete a client and ALL their future data:
    - DELETE all FUTURE bookings (data_ritiro >= today)
    - DELETE all FUTURE contracts linked to those bookings
    - Keep historical bookings/contracts (already completed)
    - Mark client as 'eliminato' to preserve history reference
    """
    from datetime import datetime as dt
    
    # Check client exists
    cliente = await db.users.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    
    if cliente.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Non puoi eliminare un amministratore")
    
    today = dt.now().strftime("%Y-%m-%d")
    
    # Find all future bookings for this client
    future_bookings = await db.prenotazioni.find(
        {
            "cliente_id": cliente_id,
            "data_ritiro": {"$gte": today}
        },
        {"id": 1, "contratto_id": 1}
    ).to_list(1000)
    
    # Get booking IDs and contract IDs to delete
    booking_ids = [b["id"] for b in future_bookings]
    contract_ids = [b["contratto_id"] for b in future_bookings if b.get("contratto_id")]
    
    # DELETE future contracts
    if contract_ids:
        await db.contratti.delete_many({"id": {"$in": contract_ids}})
    
    # DELETE future bookings
    delete_result = await db.prenotazioni.delete_many(
        {
            "cliente_id": cliente_id,
            "data_ritiro": {"$gte": today}
        }
    )
    
    # Soft-delete the client (mark as deleted, don't remove record)
    await db.users.update_one(
        {"id": cliente_id},
        {
            "$set": {
                "status": "eliminato",
                "eliminato_da": admin["id"],
                "eliminato_il": datetime.now(timezone.utc).isoformat(),
                "email": f"DELETED_{cliente_id}_{cliente.get('email', '')}"  # Prevent login
            }
        }
    )
    
    return {
        "message": "Cliente eliminato",
        "prenotazioni_eliminate": delete_result.deleted_count,
        "contratti_eliminati": len(contract_ids),
        "note": "Lo storico delle prenotazioni passate è stato mantenuto"
    }

# ========== CONTRACT PDF GENERATION ==========

@api_router.post("/prenotazioni/{prenotazione_id}/genera-contratto")
async def genera_contratto(prenotazione_id: str, admin: dict = Depends(get_admin_user)):
    """Generate contract and mark as generated"""
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    cliente = await db.users.find_one({"id": prenotazione["cliente_id"]}, {"_id": 0, "password": 0})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    
    contratto_id = str(uuid.uuid4())
    
    # Load client's credit card data into the booking
    carta_credito = cliente.get("carta_credito", {})
    if carta_credito and any(carta_credito.values()):
        carta_update = {
            "carta_circuito": carta_credito.get("circuito", ""),
            "carta_intestatario": carta_credito.get("intestatario", ""),
            "carta_numero": carta_credito.get("numero", ""),
            "carta_scadenza_mese": carta_credito.get("scadenza_mese", ""),
            "carta_scadenza_anno": carta_credito.get("scadenza_anno", "")
        }
        await db.prenotazioni.update_one(
            {"id": prenotazione_id},
            {"$set": carta_update}
        )
    
    # Create contract record
    contratto_doc = {
        "id": contratto_id,
        "prenotazione_id": prenotazione_id,
        "cliente_id": prenotazione["cliente_id"],
        "data_generazione": datetime.now(timezone.utc).isoformat(),
        "generato_da": admin["id"],
        "status": "generato"
    }
    
    await db.contratti.insert_one(contratto_doc)
    
    await db.prenotazioni.update_one(
        {"id": prenotazione_id},
        {"$set": {"contratto_generato": True, "contratto_id": contratto_id, "status": "contratto_generato"}}
    )
    
    return {"message": "Contratto generato", "contratto_id": contratto_id}

@api_router.get("/prenotazioni/{prenotazione_id}/contratto-pdf")
async def download_contratto_pdf(prenotazione_id: str, token: Optional[str] = None, user: dict = Depends(get_current_user_optional)):
    """Generate and download contract PDF"""
    # Allow token via query parameter for direct download
    if not user and token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
        except:
            pass
    
    if not user:
        raise HTTPException(status_code=401, detail="Non autorizzato")
    
    prenotazione = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not prenotazione:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    if user["role"] != "admin" and prenotazione["cliente_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    cliente = await db.users.find_one({"id": prenotazione["cliente_id"]}, {"_id": 0, "password": 0})
    condizioni = await db.settings.find_one({"type": "condizioni_generali"}, {"_id": 0})
    condizioni_testo = condizioni.get("testo", "") if condizioni else ""
    
    # Generate PDF
    pdf_buffer = generate_contract_pdf(prenotazione, cliente, condizioni_testo)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=contratto_{prenotazione_id[:8]}.pdf"}
    )

def generate_contract_pdf(prenotazione: dict, cliente: dict, condizioni_testo: str) -> BytesIO:
    """Generate professional multi-page contract PDF"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4, 
        rightMargin=1.5*cm, 
        leftMargin=1.5*cm, 
        topMargin=1.5*cm, 
        bottomMargin=1.5*cm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'ContractTitle',
        parent=styles['Heading1'],
        fontSize=14,
        spaceAfter=6,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1e40af')
    )
    
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=10,
        spaceBefore=12,
        spaceAfter=6,
        textColor=colors.HexColor('#1e40af'),
        borderWidth=1,
        borderColor=colors.HexColor('#1e40af'),
        borderPadding=4
    )
    
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#64748b')
    )
    
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontSize=9,
        fontName='Helvetica-Bold'
    )
    
    normal_style = ParagraphStyle(
        'NormalText',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        alignment=TA_JUSTIFY
    )
    
    small_style = ParagraphStyle(
        'Small',
        parent=styles['Normal'],
        fontSize=7,
        leading=9
    )
    
    elements = []
    
    # ========== HEADER ==========
    header_data = [
        [
            Paragraph(f"<b>{AGENCY_DATA['ragione_sociale']}</b><br/>"
                     f"{AGENCY_DATA['indirizzo']} - {AGENCY_DATA['cap']} {AGENCY_DATA['comune']} ({AGENCY_DATA['provincia']})<br/>"
                     f"P.IVA: {AGENCY_DATA['piva']} - CF: {AGENCY_DATA['cf']}<br/>"
                     f"Tel: {AGENCY_DATA['telefono']} - Email: {AGENCY_DATA['email']}", small_style),
            Paragraph("<b>CONTRATTO DI NOLEGGIO</b>", title_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[9*cm, 9*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    
    # Contract info bar
    contract_info = [
        [
            Paragraph(f"<b>Data stipula:</b> {datetime.now().strftime('%d/%m/%Y')}", small_style),
            Paragraph(f"<b>Dal:</b> {prenotazione['data_ritiro']} {prenotazione['ora_ritiro']}", small_style),
            Paragraph(f"<b>Al:</b> {prenotazione['data_riconsegna']} {prenotazione['ora_riconsegna']}", small_style),
            Paragraph(f"<b>Durata:</b> {prenotazione['durata_giorni']} gg", small_style),
            Paragraph(f"<b>Targa:</b> {prenotazione['veicolo_targa']}", small_style),
        ]
    ]
    info_table = Table(contract_info, colWidths=[3.6*cm]*5)
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(Spacer(1, 6))
    elements.append(info_table)
    
    # ========== I. PARTI DEL CONTRATTO ==========
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("I. PARTI DEL CONTRATTO", section_style))
    
    parti_data = [
        [Paragraph("<b>LOCATORE / NOLEGGIATORE</b>", small_style), Paragraph("<b>LOCATARIO / CLIENTE</b>", small_style)],
        [
            Paragraph(f"<b>Ragione sociale:</b> {AGENCY_DATA['ragione_sociale']}<br/>"
                     f"<b>Indirizzo:</b> {AGENCY_DATA['indirizzo']}, {AGENCY_DATA['cap']} {AGENCY_DATA['comune']} ({AGENCY_DATA['provincia']})<br/>"
                     f"<b>P.IVA / CF:</b> {AGENCY_DATA['piva']}<br/>"
                     f"<b>Tel:</b> {AGENCY_DATA['telefono']} <b>Email:</b> {AGENCY_DATA['email']}", small_style),
            Paragraph(f"<b>Nome:</b> {cliente.get('nome', '')} {cliente.get('cognome', '')}<br/>"
                     f"<b>CF:</b> {cliente.get('codice_fiscale', '')}<br/>"
                     f"<b>Nato/a:</b> {cliente.get('luogo_nascita', '')} il {cliente.get('data_nascita', '')}<br/>"
                     f"<b>Residenza:</b> {cliente.get('indirizzo', '')}, {cliente.get('cap', '')} {cliente.get('comune', '')} ({cliente.get('provincia', '')})<br/>"
                     f"<b>Tel:</b> {cliente.get('cellulare', '')} <b>Email:</b> {cliente.get('email', '')}", small_style)
        ]
    ]
    parti_table = Table(parti_data, colWidths=[9*cm, 9*cm])
    parti_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(parti_table)
    
    # ========== II. CONDUCENTI AUTORIZZATI ==========
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("II. CONDUCENTI AUTORIZZATI", section_style))
    
    patente = cliente.get('patente', {})
    conducente_data = [
        [Paragraph("<b>CONDUCENTE PRINCIPALE</b>", small_style), "", "", ""],
        [
            Paragraph(f"<b>Cognome:</b> {cliente.get('cognome', '')}", small_style),
            Paragraph(f"<b>Nome:</b> {cliente.get('nome', '')}", small_style),
            Paragraph(f"<b>Nascita:</b> {cliente.get('data_nascita', '')}", small_style),
            Paragraph(f"<b>CF:</b> {cliente.get('codice_fiscale', '')}", small_style),
        ],
        [
            Paragraph(f"<b>Residenza:</b> {cliente.get('indirizzo', '')}, {cliente.get('comune', '')} ({cliente.get('provincia', '')})", small_style),
            "",
            Paragraph(f"<b>Patente n.:</b> {patente.get('numero', '')}", small_style),
            Paragraph(f"<b>Cat:</b> {patente.get('categoria', '')} <b>Scad:</b> {patente.get('data_scadenza', '')}", small_style),
        ]
    ]
    cond_table = Table(conducente_data, colWidths=[4.5*cm, 4.5*cm, 4.5*cm, 4.5*cm])
    cond_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('SPAN', (0, 0), (-1, 0)),
        ('SPAN', (0, 2), (1, 2)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(cond_table)
    
    # Additional drivers
    if prenotazione.get('conducenti_aggiuntivi'):
        elements.append(Spacer(1, 4))
        elements.append(Paragraph("<b>ULTERIORI CONDUCENTI AUTORIZZATI</b>", small_style))
        for i, cond in enumerate(prenotazione['conducenti_aggiuntivi']):
            add_cond_data = [
                [
                    Paragraph(f"<b>{i+1}. {cond.get('nome', '')} {cond.get('cognome', '')}</b>", small_style),
                    Paragraph(f"CF: {cond.get('codice_fiscale', '')}", small_style),
                    Paragraph(f"Patente: {cond.get('patente_numero', '')} Cat: {cond.get('patente_categoria', '')}", small_style),
                    Paragraph(f"Scad: {cond.get('patente_data_scadenza', '')}", small_style),
                ]
            ]
            add_table = Table(add_cond_data, colWidths=[4.5*cm, 4.5*cm, 5*cm, 4*cm])
            add_table.setStyle(TableStyle([
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
            elements.append(add_table)
    
    # ========== III. VEICOLO ==========
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("III. VEICOLO OGGETTO DEL NOLEGGIO", section_style))
    
    check_in = prenotazione.get('check_in') or {}
    _km_val_inline = prenotazione.get('km_inclusi_totali')
    _is_unl = prenotazione.get('km_tipo') == 'illimitati' or _km_val_inline == 'ILLIMITATI' or isinstance(_km_val_inline, str)
    _km_txt = 'ILLIMITATI' if _is_unl else str(_km_val_inline or '_____')
    _prezzo_km_txt = 'N/A' if _is_unl else f"€{prenotazione.get('prezzo_km_extra', 0)}/km"
    veicolo_data = [
        [
            Paragraph(f"<b>Marca/Modello:</b> {prenotazione.get('veicolo_marca', '')} {prenotazione.get('veicolo_modello', '')}", small_style),
            Paragraph(f"<b>Targa:</b> {prenotazione.get('veicolo_targa', '')}", small_style),
            Paragraph(f"<b>Colore:</b> {prenotazione.get('veicolo_colore', '_____')}", small_style),
        ],
        [
            Paragraph(f"<b>Cambio:</b> {prenotazione.get('veicolo_cambio', '_____')}", small_style),
            Paragraph(f"<b>Alimentazione:</b> {prenotazione.get('veicolo_alimentazione', '_____')}", small_style),
            Paragraph(f"<b>Tacche carburante:</b> {check_in.get('tacche_carburante', '_____')}/8", small_style),
        ],
        [
            Paragraph(f"<b>Km uscita:</b> {check_in.get('km_uscita', '_____')}", small_style),
            Paragraph(f"<b>Km inclusi:</b> {_km_txt}", small_style),
            Paragraph(f"<b>Prezzo km extra:</b> {_prezzo_km_txt}", small_style),
        ]
    ]
    veicolo_table = Table(veicolo_data, colWidths=[6*cm, 6*cm, 6*cm])
    veicolo_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(veicolo_table)
    
    # ========== IV. DURATA & CHILOMETRAGGIO ==========
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("IV. DURATA & CHILOMETRAGGIO", section_style))
    
    km_val = prenotazione.get('km_inclusi_totali')
    is_unlimited = prenotazione.get('km_tipo') == 'illimitati' or km_val == 'ILLIMITATI' or isinstance(km_val, str)
    km_display = 'ILLIMITATI' if is_unlimited else f"{km_val} km"
    prezzo_km_display = 'N/A' if is_unlimited else f"€{prenotazione.get('prezzo_km_extra', 0)}/km"
    durata_data = [
        [
            Paragraph(f"<b>Periodo:</b> Dal {prenotazione['data_ritiro']} {prenotazione['ora_ritiro']} al {prenotazione['data_riconsegna']} {prenotazione['ora_riconsegna']}", small_style),
            Paragraph(f"<b>Durata:</b> {prenotazione['durata_giorni']} giorni", small_style),
        ],
        [
            Paragraph(f"<b>Km inclusi totali:</b> {km_display}", small_style),
            Paragraph(f"<b>Prezzo km extra:</b> {prezzo_km_display}", small_style),
        ],
        [
            Paragraph(f"<b>Acconto:</b> €{prenotazione.get('acconto', 0):.2f}", small_style),
            Paragraph(f"<b>Deposito cauzionale:</b> €{prenotazione['deposito_cauzionale']:.2f}", small_style),
        ]
    ]
    durata_table = Table(durata_data, colWidths=[9*cm, 9*cm])
    durata_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(durata_table)
    
    # ========== V. CORRISPETTIVO & SERVIZI ==========
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("V. CORRISPETTIVO & SERVIZI", section_style))
    
    # Servizi supplementari
    servizi = prenotazione.get('servizi_supplementari', [])
    if servizi:
        serv_header = [["SERVIZIO", "Q.TÀ", "UNITÀ", "TOTALE"]]
        serv_rows = [[s.get('nome', ''), str(s.get('quantita', 1)), s.get('unita', 'gg'), f"€{s.get('totale', 0):.2f}"] for s in servizi]
        serv_data = serv_header + serv_rows
    else:
        serv_data = [["Nessun servizio supplementare associato a questo noleggio."]]
    
    serv_table = Table(serv_data, colWidths=[8*cm, 2.5*cm, 3*cm, 4.5*cm] if servizi else [18*cm])
    serv_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(serv_table)
    
    # Riepilogo economico
    elements.append(Spacer(1, 6))
    totale_iva = prenotazione['tariffa_base'] + prenotazione.get('totale_servizi', 0) + prenotazione.get('totale_franchigie', 0)
    saldo = totale_iva - prenotazione.get('acconto', 0)
    
    riepilogo_data = [
        [Paragraph("<b>RIEPILOGO ECONOMICO</b>", small_style), ""],
        ["Tariffa base noleggio", f"€{prenotazione['tariffa_base']:.2f}"],
        ["Servizi supplementari", f"€{prenotazione.get('totale_servizi', 0):.2f}"],
        ["Franchigie assicurative", f"€{prenotazione.get('totale_franchigie', 0):.2f}"],
        ["Totale (IVA inclusa)", f"€{totale_iva:.2f}"],
        ["Acconto già versato", f"€{prenotazione.get('acconto', 0):.2f}"],
        [Paragraph("<b>Saldo alla consegna</b>", small_style), Paragraph(f"<b>€{saldo:.2f}</b>", small_style)],
    ]
    riep_table = Table(riepilogo_data, colWidths=[12*cm, 6*cm])
    riep_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dbeafe')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#bfdbfe')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(riep_table)
    
    # ========== VI. LUOGO CHECK-IN/OUT ==========
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("VI. LUOGO CHECK-IN & CHECK-OUT", section_style))
    
    checkin_data = [
        [Paragraph("<b>CHECK-IN</b>", small_style), Paragraph("<b>CHECK-OUT</b>", small_style)],
        [
            Paragraph(f"<b>Luogo:</b> {prenotazione.get('luogo_ritiro', AGENCY_DATA['sede_checkin']['nome'])}<br/>"
                     f"<b>Indirizzo:</b> {prenotazione.get('indirizzo_ritiro', AGENCY_DATA['sede_checkin']['indirizzo'])}", small_style),
            Paragraph(f"<b>Luogo:</b> {prenotazione.get('luogo_riconsegna', AGENCY_DATA['sede_checkin']['nome'])}<br/>"
                     f"<b>Indirizzo:</b> {prenotazione.get('indirizzo_riconsegna', AGENCY_DATA['sede_checkin']['indirizzo'])}", small_style),
        ]
    ]
    checkin_table = Table(checkin_data, colWidths=[9*cm, 9*cm])
    checkin_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(checkin_table)
    
    # ========== VII. DANNI PREESISTENTI ==========
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("VII. DANNI PREESISTENTI", section_style))
    
    danni = prenotazione.get('danni_preesistenti', [])
    if danni:
        danni_header = [["PUNTO", "DESCRIZIONE DEL DANNO"]]
        danni_rows = [[d.get('punto', ''), d.get('descrizione', '')] for d in danni]
        danni_data = danni_header + danni_rows
    else:
        danni_data = [["Nessun danno dichiarato al momento della consegna."]]
    
    danni_table = Table(danni_data, colWidths=[4*cm, 14*cm] if danni else [18*cm])
    danni_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')) if danni else ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(danni_table)
    elements.append(Paragraph("<i>Eventuali danni non riportati in tabella si presumono inesistenti al momento della consegna del veicolo al locatario.</i>", small_style))
    
    # ========== PAGE BREAK ==========
    elements.append(PageBreak())
    
    # ========== V-BIS. RIENTRO & ADDEBITI ==========
    elements.append(Paragraph("V-BIS. RIENTRO & ADDEBITI", section_style))
    
    check_out = prenotazione.get('check_out') or {}
    rientro_data = [
        [Paragraph("<b>DATI RIENTRO</b>", small_style), "", Paragraph("<b>ADDEBITI AL RIENTRO</b>", small_style), ""],
        [
            "Data/ora rientro effettivo:", check_out.get('data_ora_rientro', '________________'),
            "Danni veicolo:", f"€{check_out.get('danni_veicolo', 0):.2f}"
        ],
        [
            "Km entrata:", str(check_out.get('km_entrata', '________')),
            "Costo gestione danni:", f"€{check_out.get('costo_gestione_danni', 0):.2f}"
        ],
        [
            "Km percorsi:", str(check_out.get('km_percorsi', '________')),
            "Carburante mancante:", f"€{check_out.get('carburante_mancante', 0):.2f}"
        ],
        [
            "Km eccedenza:", str(check_out.get('km_eccedenza', '________')),
            "Pulizia straordinaria:", f"€{check_out.get('pulizia_straordinaria', 0):.2f}"
        ],
        [
            "Importo km eccedenza:", f"€{check_out.get('importo_km_eccedenza', 0):.2f}",
            "Altri addebiti:", f"€{check_out.get('altri_addebiti', 0):.2f}"
        ],
        [
            "Tacche carburante entrata:", f"{check_out.get('tacche_carburante_entrata', '____')}/8",
            Paragraph("<b>TOTALE ADDEBITI RIENTRO:</b>", small_style), Paragraph(f"<b>€{check_out.get('totale_addebiti', 0):.2f}</b>", small_style)
        ],
    ]
    rientro_table = Table(rientro_data, colWidths=[5*cm, 4*cm, 5*cm, 4*cm])
    rientro_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (2, 0), (3, 0), colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (2, -1), (3, -1), colors.HexColor('#fef3c7')),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(rientro_table)
    
    # ========== VIII. GARANZIE & PAGAMENTO ==========
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("VIII. GARANZIE & PAGAMENTO", section_style))
    
    garanzia = prenotazione.get('garanzia_pagamento', {}) or {}
    garanzia_data = [
        [Paragraph("<b>GARANTE</b>", small_style), "", Paragraph("<b>CARTA</b>", small_style), ""],
        [
            "Garante:", garanzia.get('garante_nome', '________________'),
            "Circuito:", garanzia.get('carta_circuito', '________________')
        ],
        [
            "Recapiti:", garanzia.get('garante_recapiti', '________________'),
            "Intestatario:", garanzia.get('carta_intestatario', '________________')
        ],
        [
            "Documento:", garanzia.get('garante_documento', '________________'),
            "Ultime cifre:", garanzia.get('carta_ultime_cifre', '****____'),
        ],
        [
            "", "",
            "Scadenza:", garanzia.get('carta_scadenza', '__/__')
        ],
        [
            Paragraph("<b>METODO PAGAMENTO:</b>", small_style), garanzia.get('metodo_pagamento', 'Contanti'),
            "", ""
        ],
    ]
    garanzia_table = Table(garanzia_data, colWidths=[4*cm, 5*cm, 4*cm, 5*cm])
    garanzia_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (2, 0), (3, 0), colors.HexColor('#e2e8f0')),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(garanzia_table)
    
    # ========== IX. CONDIZIONI GENERALI ==========
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("IX. CONDIZIONI GENERALI DI NOLEGGIO", section_style))
    
    # Split conditions into paragraphs
    if condizioni_testo:
        for para in condizioni_testo.split('\n\n'):
            if para.strip():
                elements.append(Paragraph(para.strip(), small_style))
                elements.append(Spacer(1, 3))
    
    # ========== X. DICHIARAZIONI E SOTTOSCRIZIONI ==========
    elements.append(PageBreak())
    elements.append(Paragraph("X. DICHIARAZIONI E SOTTOSCRIZIONI", section_style))
    
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "Il sottoscritto locatario dichiara di aver letto attentamente e di accettare integralmente le condizioni generali "
        "di noleggio riportate nel presente contratto, nonché ogni clausola ivi contenuta.",
        normal_style
    ))
    
    elements.append(Spacer(1, 15))
    
    # Signatures
    firma_data = [
        [Paragraph("<b>IL LOCATORE / NOLEGGIATORE</b>", label_style), "", Paragraph("<b>IL LOCATARIO / CLIENTE</b>", label_style)],
        ["", "", ""],
        ["____________________________", "", "____________________________"],
        [f"{AGENCY_DATA['ragione_sociale']}", "", f"{cliente.get('nome', '')} {cliente.get('cognome', '')}"],
    ]
    
    firma_table = Table(firma_data, colWidths=[7*cm, 4*cm, 7*cm])
    firma_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(firma_table)
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(
        "<i>Firma apposta ai sensi e per gli effetti degli artt. 1341 e 1342 c.c. con specifica approvazione delle clausole "
        "eventualmente indicate nelle condizioni generali di noleggio.</i>",
        small_style
    ))
    
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(
        f"<b>Luogo e data:</b> {AGENCY_DATA['comune']}, {datetime.now().strftime('%d/%m/%Y')}",
        normal_style
    ))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer

# ========== ADMIN DASHBOARD STATS ==========

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(admin: dict = Depends(get_admin_user)):
    total_vehicles = await db.vehicles.count_documents({})
    available_vehicles = await db.vehicles.count_documents({"status": "disponibile"})
    active_rentals = await db.prenotazioni.count_documents({"status": "consegnato"})
    pending = await db.prenotazioni.count_documents({"status": {"$in": ["bozza", "in_verifica"]}})
    total_clients = await db.users.count_documents({"role": "client"})
    contracts_generated = await db.prenotazioni.count_documents({"contratto_generato": True})
    
    return {
        "total_vehicles": total_vehicles,
        "available_vehicles": available_vehicles,
        "active_rentals": active_rentals,
        "pending_bookings": pending,
        "total_clients": total_clients,
        "contracts_generated": contracts_generated
    }

@api_router.post("/fix-contratto-flags")
async def fix_contratto_flags(admin: dict = Depends(get_admin_user)):
    """Fix bookings with status contratto_generato but missing flag"""
    result = await db.prenotazioni.update_many(
        {"status": "contratto_generato", "contratto_generato": {"$ne": True}},
        {"$set": {"contratto_generato": True}}
    )
    return {"fixed": result.modified_count}

# ========== SEED DATA ==========

@api_router.post("/seed")
async def seed_data():
    # Admin user
    admin = await db.users.find_one({"email": "giannibruzzese@gmail.com"})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "giannibruzzese@gmail.com",
            "password": hash_password("admin123"),
            "nome": "Amministratore",
            "cognome": "Sistema",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Sample vehicles
    vehicle_count = await db.vehicles.count_documents({})
    if vehicle_count == 0:
        vehicles = [
            {
                "id": str(uuid.uuid4()),
                "marca": "Fiat",
                "modello": "Panda",
                "targa": "FT123AB",
                "colore": "Bianco",
                "cambio": "Manuale",
                "alimentazione": "Benzina",
                "anno": 2023,
                "posti": 5,
                "km_attuali": 15000,
                "tariffa_giornaliera": 35.00,
                "deposito_cauzionale": 300.00,
                "km_inclusi_giorno": 200,
                "prezzo_km_extra": 0.20,
                "image_url": "https://images.unsplash.com/photo-1595787572747-6c73ca9c6ce0?w=800",
                "status": "disponibile",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "marca": "Volkswagen",
                "modello": "Golf",
                "targa": "VW456CD",
                "colore": "Grigio",
                "cambio": "Automatico",
                "alimentazione": "Diesel",
                "anno": 2024,
                "posti": 5,
                "km_attuali": 8000,
                "tariffa_giornaliera": 55.00,
                "deposito_cauzionale": 500.00,
                "km_inclusi_giorno": 250,
                "prezzo_km_extra": 0.25,
                "image_url": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800",
                "status": "disponibile",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "marca": "BMW",
                "modello": "Serie 3",
                "targa": "BM789EF",
                "colore": "Nero",
                "cambio": "Automatico",
                "alimentazione": "Ibrido",
                "anno": 2024,
                "posti": 5,
                "km_attuali": 5000,
                "tariffa_giornaliera": 95.00,
                "deposito_cauzionale": 1000.00,
                "km_inclusi_giorno": 300,
                "prezzo_km_extra": 0.35,
                "image_url": "https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=800",
                "status": "disponibile",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.vehicles.insert_many(vehicles)
    
    # Default franchigie (specifiche RE.LE.CO. GROUP)
    franch_count = await db.franchigie.count_documents({})
    if franch_count == 0:
        franchigie = [
            {
                "id": str(uuid.uuid4()),
                "nome": "ATTIVAZIONE KASKO CON FRANCHIGIA DANNI",
                "descrizione": "Copertura danni con franchigia massima €500",
                "importo_massimo": 500.00,
                "costo_giornaliero": 15.00,
                "codice": "KASKO",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "PENALITA' PER SINISTRO CON RESPONSABILITA'",
                "descrizione": "Penale in caso di sinistro con responsabilità del conducente",
                "importo_massimo": 250.00,
                "costo_giornaliero": 0,
                "codice": "SINISTRO",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "SCOPERTO 10% INCENDIO E FURTO",
                "descrizione": "Scoperto del 10% sul valore del veicolo in caso di incendio o furto",
                "importo_massimo": 0,
                "percentuale_scoperto": 10,
                "costo_giornaliero": 0,
                "codice": "FURTO_INCENDIO",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.franchigie.insert_many(franchigie)
    
    # Default servizi
    serv_count = await db.servizi_supplementari.count_documents({})
    if serv_count == 0:
        servizi = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Seggiolino bambini",
                "descrizione": "Seggiolino omologato per bambini",
                "prezzo_unitario": 5.00,
                "unita": "giorno",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "GPS Navigatore",
                "descrizione": "Navigatore GPS portatile",
                "prezzo_unitario": 8.00,
                "unita": "giorno",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Conducente aggiuntivo",
                "descrizione": "Aggiunta di un conducente autorizzato",
                "prezzo_unitario": 10.00,
                "unita": "noleggio",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.servizi_supplementari.insert_many(servizi)
    
    return {
        "message": "Dati di esempio creati",
        "admin_email": "giannibruzzese@gmail.com",
        "admin_password": "admin123"
    }

# ========== EMAIL ENDPOINTS ==========

@api_router.get("/email/log")
async def get_email_log(admin: dict = Depends(get_admin_user)):
    """Get log of sent emails"""
    logs = await db.email_log.find({}, {"_id": 0}).sort("sent_at", -1).to_list(50)
    return logs

@api_router.post("/email/test-reminder/{prenotazione_id}")
async def test_send_reminder(prenotazione_id: str, admin: dict = Depends(get_admin_user)):
    """Manually send a return reminder for a booking (for testing)"""
    booking = await db.prenotazioni.find_one({"id": prenotazione_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    email = booking.get("cliente_email", "")
    nome = booking.get("cliente_nome", "Cliente")
    
    if not email:
        raise HTTPException(status_code=400, detail="Nessuna email cliente")
    
    if not BREVO_CONFIGURED:
        raise HTTPException(status_code=400, detail="Brevo SMTP non configurato")
    
    html = build_return_reminder_html(booking)
    ora_ric = booking.get("ora_riconsegna", "18:00")
    subject = f"Promemoria: Riconsegna {booking.get('veicolo_marca', '')} {booking.get('veicolo_modello', '')} - ore {ora_ric}"
    
    success = send_brevo_email(email, nome, subject, html)
    
    await db.email_log.insert_one({
        "key": f"test_reminder_{prenotazione_id}_{datetime.now(timezone.utc).isoformat()}",
        "booking_id": prenotazione_id,
        "email": email,
        "type": "test_return_reminder",
        "sent": success,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    if success:
        return {"message": f"Email promemoria inviata a {email}", "success": True}
    else:
        raise HTTPException(status_code=500, detail="Errore invio email")

@api_router.post("/email/test-weekly-calendar")
async def test_weekly_calendar(admin: dict = Depends(get_admin_user)):
    """Manually trigger the weekly calendar Excel email"""
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from io import BytesIO
    from email.mime.base import MIMEBase
    from email import encoders
    
    if not BREVO_CONFIGURED:
        raise HTTPException(status_code=400, detail="Brevo SMTP non configurato")
    
    bookings = await db.prenotazioni.find(
        {"status": {"$nin": ["annullata"]}}, {"_id": 0}
    ).sort("data_ritiro", 1).to_list(1000)
    
    notes = await db.calendar_notes.find({}, {"_id": 0}).sort("data", 1).to_list(500)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Prenotazioni"
    
    hf = Font(bold=True, color="FFFFFF", size=10)
    hfill = PatternFill(start_color="1a2744", end_color="1a2744", fill_type="solid")
    tb = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
    
    for col, h in enumerate(["Stato","Cliente","Email","Cellulare","Veicolo","Targa","Data Ritiro","Ora Ritiro","Data Riconsegna","Ora Riconsegna","Giorni","Tariffa/gg","Totale","Note"], 1):
        c = ws.cell(row=1, column=col, value=h)
        c.font = hf; c.fill = hfill; c.alignment = Alignment(horizontal='center'); c.border = tb
    
    for ri, b in enumerate(bookings, 2):
        dr = b.get('data_ritiro',''); drc = b.get('data_riconsegna','')
        if dr and len(dr)>=10: dr = f"{dr[8:10]}/{dr[5:7]}/{dr[:4]}"
        if drc and len(drc)>=10: drc = f"{drc[8:10]}/{drc[5:7]}/{drc[:4]}"
        for ci, v in enumerate([b.get('status',''), b.get('cliente_nome',''), b.get('cliente_email',''), b.get('cliente_cellulare',''), f"{b.get('veicolo_marca','')} {b.get('veicolo_modello','')}", b.get('veicolo_targa',''), dr, b.get('ora_ritiro',''), drc, b.get('ora_riconsegna',''), b.get('durata_giorni',''), b.get('tariffa_giornaliera',''), b.get('tariffa_base',''), b.get('note','')], 1):
            ws.cell(row=ri, column=ci, value=v).border = tb
    
    ws2 = wb.create_sheet("Note Calendario")
    for col, h in enumerate(["Data","Titolo","Contenuto"], 1):
        c = ws2.cell(row=1, column=col, value=h)
        c.font = hf; c.fill = PatternFill(start_color="E65100", end_color="E65100", fill_type="solid"); c.border = tb
    for ri, n in enumerate(notes, 2):
        dn = n.get('data','')
        if dn and len(dn)>=10: dn = f"{dn[8:10]}/{dn[5:7]}/{dn[:4]}"
        ws2.cell(row=ri, column=1, value=dn).border = tb
        ws2.cell(row=ri, column=2, value=n.get('titolo','')).border = tb
        ws2.cell(row=ri, column=3, value=n.get('contenuto','')).border = tb
    
    buf = BytesIO(); wb.save(buf); excel_bytes = buf.getvalue()
    
    now_it = datetime.now(timezone.utc) + timedelta(hours=2)
    msg = MIMEMultipart('mixed')
    msg['Subject'] = f"Calendario Prenotazioni - {now_it.strftime('%d/%m/%Y')}"
    msg['From'] = f'{BREVO_SENDER_NAME} <{BREVO_SENDER_EMAIL}>'
    msg['To'] = 'soverato.rental@libero.it'
    msg.attach(MIMEText(f"<h2>Calendario Prenotazioni</h2><p>Prenotazioni: {len(bookings)}, Note: {len(notes)}</p>", 'html'))
    
    att = MIMEBase('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    att.set_payload(excel_bytes)
    encoders.encode_base64(att)
    att.add_header('Content-Disposition', 'attachment', filename=f"calendario_{now_it.strftime('%d_%m_%Y')}.xlsx")
    msg.attach(att)
    
    try:
        sv = smtplib.SMTP(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, timeout=15)
        sv.starttls(); sv.login(BREVO_SMTP_LOGIN, BREVO_SMTP_KEY)
        sv.sendmail(BREVO_SENDER_EMAIL, ['soverato.rental@libero.it'], msg.as_string())
        sv.quit()
        return {"message": f"Calendario Excel inviato a soverato.rental@libero.it ({len(bookings)} prenotazioni, {len(notes)} note)", "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore invio: {str(e)}")

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
