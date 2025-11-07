#!/usr/bin/env python3
"""
Simple Flask Backend for Noetika Tracking System
This receives and stores user tracking data to CSV files
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import csv
import requests
import json
import os
from dotenv import load_dotenv

# Carrega variáveis de ambiente do arquivo .env (se existir)
load_dotenv()
import hashlib
import base64
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from pathlib import Path
from io import BytesIO
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.pdfgen import canvas
from PIL import Image as PILImage

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Data directory
DATA_DIR = Path('tracking_data')
DATA_DIR.mkdir(exist_ok=True)

# CSV files
SESSIONS_CSV = DATA_DIR / 'sessions.csv'
EVENTS_CSV = DATA_DIR / 'events.csv'
REPORTS_CSV = DATA_DIR / 'reports.csv'

# Initialize CSV files if they don't exist
def init_csv_files():
    if not SESSIONS_CSV.exists():
        with open(SESSIONS_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'session_id', 'start_time', 'user_agent', 'screen_resolution',
                'language', 'referrer', 'ip', 'city', 'region', 'country',
                'country_code', 'latitude', 'longitude', 'timezone'
            ])
    
    if not EVENTS_CSV.exists():
        with open(EVENTS_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'session_id', 'event_type', 'timestamp', 'page', 'event_data'
            ])
    
    if not REPORTS_CSV.exists():
        with open(REPORTS_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'hash', 'session_id', 'generated_at', 'ip', 'city', 'priorities'
            ])

init_csv_files()

@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('.', 'index.html')

@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'backend'}), 200

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('.', path)

@app.route('/api/get-location', methods=['GET'])
def get_location():
    """Get user location from IP using backend (avoids CORS issues)"""
    try:
        # Get client IP
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if client_ip and ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()
        
        # If localhost, try to get public IP from API (without specifying IP)
        if client_ip in ['127.0.0.1', '::1', 'localhost']:
            # For localhost, query API without IP to get server's public IP and location
            try:
                response = requests.get('https://ipapi.co/json/', timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    if 'error' not in data and data.get('ip'):
                        return jsonify({
                            'ip': data.get('ip', ''),
                            'city': data.get('city', ''),
                            'region': data.get('region', ''),
                            'country': data.get('country_name', ''),
                            'country_code': data.get('country_code', ''),
                            'latitude': data.get('latitude', ''),
                            'longitude': data.get('longitude', ''),
                            'timezone': data.get('timezone', '')
                        }), 200
            except Exception as e:
                print(f"Erro ao buscar localização pública via API: {e}")
            # Fallback: return localhost IP
            return jsonify({
                'ip': '127.0.0.1',
                'city': '',
                'region': '',
                'country': '',
                'country_code': '',
                'latitude': '',
                'longitude': '',
                'timezone': ''
            }), 200
        
        # If we have a real IP, query API with that IP
        if client_ip:
            try:
                response = requests.get(f'https://ipapi.co/{client_ip}/json/', timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    if 'error' not in data:
                        return jsonify({
                            'ip': data.get('ip', client_ip),
                            'city': data.get('city', ''),
                            'region': data.get('region', ''),
                            'country': data.get('country_name', ''),
                            'country_code': data.get('country_code', ''),
                            'latitude': data.get('latitude', ''),
                            'longitude': data.get('longitude', ''),
                            'timezone': data.get('timezone', '')
                        }), 200
            except Exception as e:
                print(f"Erro ao buscar localização via API: {e}")
        
        # Final fallback
        return jsonify({
            'ip': client_ip or request.remote_addr,
            'city': '',
            'region': '',
            'country': '',
            'country_code': '',
            'latitude': '',
            'longitude': '',
            'timezone': ''
        }), 200
        
    except Exception as e:
        print(f"Erro em get-location: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/track', methods=['POST'])
def track_event():
    """Receive and store tracking event"""
    try:
        data = request.json
        session = data.get('session', {})
        event = data.get('event', {})
        
        # Try to get IP from request if not in session
        if not session.get('ip'):
            client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            if client_ip and ',' in client_ip:
                client_ip = client_ip.split(',')[0].strip()
            if client_ip and client_ip not in ['127.0.0.1', '::1', 'localhost']:
                session['ip'] = client_ip
        
        # Save session info (update if exists or if location was updated)
        session_id = session.get('sessionId')
        if session_id:
            location = session.get('location', {})
            session_ip = session.get('ip', '')
            has_location_data = session_ip or (location and not location.get('error'))
            
            # Check if session already exists
            session_exists = False
            session_has_location = False
            
            if SESSIONS_CSV.exists():
                with open(SESSIONS_CSV, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    rows = list(reader)
                    for row in rows:
                        if row['session_id'] == session_id:
                            session_exists = True
                            # Check if session already has location data
                            if row.get('ip') or row.get('city'):
                                session_has_location = True
                            break
            
            # Always save session if it's new
            # Update existing session only if location data is now available and wasn't before
            if not session_exists:
                # Add new session
                with open(SESSIONS_CSV, 'a', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow([
                        session_id,
                        session.get('startTime', ''),
                        session.get('userAgent', ''),
                        session.get('screenResolution', ''),
                        session.get('language', ''),
                        session.get('referrer', ''),
                        session_ip,
                        location.get('city', '') if location else '',
                        location.get('region', '') if location else '',
                        location.get('country', '') if location else '',
                        location.get('country_code', '') if location else '',
                        str(location.get('latitude', '')) if location else '',
                        str(location.get('longitude', '')) if location else '',
                        location.get('timezone', '') if location else ''
                    ])
            elif has_location_data and not session_has_location:
                # Update existing session with new location data
                if session_exists:
                    # Update existing session - read all rows, update, rewrite
                    updated_rows = []
                    with open(SESSIONS_CSV, 'r', encoding='utf-8') as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            if row['session_id'] == session_id:
                                # Update this row with new location data
                                row['ip'] = session_ip if session_ip else row.get('ip', '')
                                row['city'] = location.get('city', '') if location else row.get('city', '')
                                row['region'] = location.get('region', '') if location else row.get('region', '')
                                row['country'] = location.get('country', '') if location else row.get('country', '')
                                row['country_code'] = location.get('country_code', '') if location else row.get('country_code', '')
                                row['latitude'] = str(location.get('latitude', '')) if location else row.get('latitude', '')
                                row['longitude'] = str(location.get('longitude', '')) if location else row.get('longitude', '')
                                row['timezone'] = location.get('timezone', '') if location else row.get('timezone', '')
                            updated_rows.append(row)
                    
                    # Rewrite CSV with updated data
                    with open(SESSIONS_CSV, 'w', newline='', encoding='utf-8') as f:
                        if updated_rows:
                            writer = csv.DictWriter(f, fieldnames=updated_rows[0].keys())
                            writer.writeheader()
                            writer.writerows(updated_rows)
                else:
                    # Add new session
                    with open(SESSIONS_CSV, 'a', newline='', encoding='utf-8') as f:
                        writer = csv.writer(f)
                        writer.writerow([
                            session_id,
                            session.get('startTime', ''),
                            session.get('userAgent', ''),
                            session.get('screenResolution', ''),
                            session.get('language', ''),
                            session.get('referrer', ''),
                            session_ip,
                            location.get('city', '') if location else '',
                            location.get('region', '') if location else '',
                            location.get('country', '') if location else '',
                            location.get('country_code', '') if location else '',
                            str(location.get('latitude', '')) if location else '',
                            str(location.get('longitude', '')) if location else '',
                            location.get('timezone', '') if location else ''
                        ])
        
        # Save event
        if event:
            with open(EVENTS_CSV, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow([
                    session_id,
                    event.get('type', ''),
                    event.get('timestamp', ''),
                    event.get('page', ''),
                    json.dumps(event.get('data', {}))
                ])
        
        return jsonify({'status': 'success'}), 200
    
    except Exception as e:
        print(f"Error tracking event: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get all sessions"""
    try:
        sessions = []
        if SESSIONS_CSV.exists():
            with open(SESSIONS_CSV, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                sessions = list(reader)
        
        return jsonify(sessions), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/events/<session_id>', methods=['GET'])
def get_session_events(session_id):
    """Get events for a specific session"""
    try:
        events = []
        if EVENTS_CSV.exists():
            with open(EVENTS_CSV, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                events = [row for row in reader if row['session_id'] == session_id]
        
        return jsonify(events), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get tracking statistics"""
    try:
        stats = {
            'total_sessions': 0,
            'total_events': 0,
            'events_by_type': {},
            'recent_sessions': []
        }
        
        # Count sessions
        if SESSIONS_CSV.exists():
            with open(SESSIONS_CSV, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                sessions = list(reader)
                stats['total_sessions'] = len(sessions)
                stats['recent_sessions'] = sessions[-10:]
        
        # Count events
        if EVENTS_CSV.exists():
            with open(EVENTS_CSV, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    stats['total_events'] += 1
                    event_type = row['event_type']
                    stats['events_by_type'][event_type] = stats['events_by_type'].get(event_type, 0) + 1
        
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    """Generate PDF report and send via email"""
    try:
        data = request.json
        ranking = data.get('ranking', [])
        podium = data.get('podium', [])  # Dados do podium (Ouro, Prata, Bronze)
        priorities = data.get('priorities', {})
        graph_image_base64 = data.get('graphImage', '')
        session_id = data.get('sessionId', '')
        
        # Get current date and time
        now = datetime.now()
        date_str = now.strftime('%d/%m/%Y')
        time_str = now.strftime('%H:%M:%S')
        
        # Get user IP and city from session data
        user_ip = 'N/A'
        user_city = 'N/A'
        
        if session_id and SESSIONS_CSV.exists():
            with open(SESSIONS_CSV, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['session_id'] == session_id:
                        user_ip = row.get('ip', 'N/A')
                        user_city = row.get('city', 'N/A')
                        break
        
        # Generate hash
        hash_data = f"{session_id}{now.isoformat()}{json.dumps(ranking)}"
        report_hash = hashlib.sha256(hash_data.encode()).hexdigest()[:16]
        
        # Create PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, 
                               rightMargin=72, leftMargin=72,
                               topMargin=72, bottomMargin=72)
        
        # Container for the 'Flowable' objects
        elements = []
        
        # Define styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#000000'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#000000'),
            spaceAfter=12
        )
        
        # Title
        elements.append(Paragraph("Tribússula report", title_style))
        elements.append(Spacer(1, 12))
        
        # Hash
        elements.append(Paragraph(f"<b>Hash:</b> {report_hash}", styles['Normal']))
        elements.append(Spacer(1, 6))
        
        # IP and City
        elements.append(Paragraph(
            f"Requisitado a partir de: {user_ip}, {user_city}",
            styles['Normal']
        ))
        elements.append(Spacer(1, 20))
        
        # Subtitle with priorities
        priorities_text = f"Ranking priorizando {priorities.get('custo', '0')}% custo, {priorities.get('qualidade', '0')}% qualidade e {priorities.get('prazo', '0')}% prazo"
        elements.append(Paragraph(priorities_text, styles['Normal']))
        elements.append(Spacer(1, 30))
        
        # Ranking table - Centralizada
        table_data = [['#', 'Categoria', 'Nome', 'Nota', 'Margem de Erro']]
        for item in ranking:
            table_data.append([
                str(item['position']),
                item.get('categoria', item.get('cluster', 'N/A')),  # Suporta ambos para compatibilidade
                item['name'] + (f" ({item['coord']})" if item.get('coord') else ''),
                item['nota'],
                item['margemErro']
            ])
        
        ranking_table = Table(table_data, colWidths=[0.5*inch, 1*inch, 3*inch, 0.8*inch, 1*inch])
        ranking_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),  # TUDO CENTRALIZADO
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
        ]))
        
        elements.append(ranking_table)
        elements.append(Spacer(1, 30))
        elements.append(PageBreak())
        
        # Graph image
        if graph_image_base64:
            try:
                # Remove data URL prefix if present
                if ',' in graph_image_base64:
                    graph_image_base64 = graph_image_base64.split(',')[1]
                
                # Decode base64 image
                image_data = base64.b64decode(graph_image_base64)
                img_buffer = BytesIO(image_data)
                img = PILImage.open(img_buffer)
                
                # Convert to RGB if necessary
                if img.mode == 'RGBA':
                    rgb_img = PILImage.new('RGB', img.size, (255, 255, 255))
                    rgb_img.paste(img, mask=img.split()[3])
                    img = rgb_img
                
                # Save to buffer
                img_buffer = BytesIO()
                img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                
                # Add image to PDF
                reportlab_img = Image(img_buffer, width=6*inch, height=2.3*inch)
                elements.append(reportlab_img)
            except Exception as e:
                print(f"Erro ao adicionar gráfico ao PDF: {e}")
                elements.append(Paragraph(f"<i>Gráfico não disponível: {str(e)}</i>", styles['Normal']))
        
        # Podium section - Ouro, Prata, Bronze
        if podium and len(podium) > 0:
            elements.append(Spacer(1, 30))
            elements.append(PageBreak())
            elements.append(Paragraph("Podium", heading_style))
            elements.append(Spacer(1, 20))
            
            for podium_item in podium:
                categoria = podium_item.get('categoria', 'N/A')
                items = podium_item.get('items', [])
                
                if not items:
                    continue
                
                # Título da categoria
                elements.append(Paragraph(f"<b>{categoria}</b>", styles['Heading3']))
                elements.append(Spacer(1, 12))
                
                # Para cada solução nesta categoria
                for solution_item in items:
                    solution_data = solution_item.get('solutionData')
                    if not solution_data:
                        # Se não tem dados completos, mostra só o básico
                        elements.append(Paragraph(
                            f"<b>{solution_item.get('nome', 'N/A')}</b> ({solution_item.get('coord', 'N/A')})",
                            styles['Normal']
                        ))
                        elements.append(Paragraph(
                            f"Nota: {solution_item.get('nota', 'N/A')} | Margem de Erro: {solution_item.get('margemErro', 'N/A')}",
                            styles['Normal']
                        ))
                        elements.append(Spacer(1, 10))
                        continue
                    
                    # Nome e ID
                    nome_solucao = solution_data.get('nome') or solution_data.get('nome_curto', 'N/A')
                    linha_tronco = solution_data.get('linha') or solution_data.get('tronco', 'N/A')
                    sinal_dados = solution_data.get('sinal_dados', '')
                    linha_text = f"Linha {linha_tronco}" if linha_tronco != 'N/A' else ''
                    elements.append(Paragraph(
                        f"<b>{nome_solucao}</b> ({solution_data.get('id', 'N/A')}) {linha_text} {sinal_dados}".strip(),
                        styles['Normal']
                    ))
                    elements.append(Spacer(1, 6))
                    
                    # Descrição Simplificada (prioridade)
                    if solution_data.get('descricao_para_leigos'):
                        elements.append(Paragraph(f"<b>Descrição Simplificada:</b> {solution_data.get('descricao_para_leigos')}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Descrição (fallback)
                    if solution_data.get('descricao'):
                        elements.append(Paragraph(f"<b>Descrição:</b> {solution_data.get('descricao')}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Escopo
                    if solution_data.get('escopo') and isinstance(solution_data.get('escopo'), list):
                        elements.append(Paragraph("<b>Escopo:</b>", styles['Normal']))
                        for escopo_item in solution_data.get('escopo', []):
                            elements.append(Paragraph(f"• {escopo_item}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Custo
                    custo_text = []
                    if solution_data.get('preco_cliente'):
                        preco = solution_data.get('preco_cliente', {})
                        if preco.get('capex_brl'):
                            custo_text.append(f"CAPEX: R$ {preco.get('capex_brl'):,.2f}")
                        if preco.get('opex_mensal_brl'):
                            custo_text.append(f"OPEX Mensal: R$ {preco.get('opex_mensal_brl'):,.2f}")
                        if preco.get('preco_cliente_ano1_brl'):
                            custo_text.append(f"Custo Ano 1 (Cliente): R$ {preco.get('preco_cliente_ano1_brl'):,.2f}")
                    else:
                        if solution_data.get('capex_brl'):
                            custo_text.append(f"CAPEX: R$ {solution_data.get('capex_brl'):,.2f}")
                        if solution_data.get('opex_mensal_brl'):
                            custo_text.append(f"OPEX Mensal: R$ {solution_data.get('opex_mensal_brl'):,.2f}")
                    if solution_data.get('custo_ano1_brl'):
                        custo_text.append(f"Custo Ano 1: R$ {solution_data.get('custo_ano1_brl'):,.2f}")
                    if custo_text:
                        elements.append(Paragraph(f"<b>Custo:</b> {', '.join(custo_text)}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Prazos
                    if solution_data.get('prazos_dias'):
                        prazos = solution_data.get('prazos_dias', {})
                        prazo_text = []
                        if prazos.get('total'):
                            prazo_text.append(f"Total: {prazos.get('total')} dias")
                        if prazos.get('sigma'):
                            prazo_text.append(f"σ (Incerteza): {prazos.get('sigma')} dias")
                        if prazo_text:
                            elements.append(Paragraph(f"<b>Prazo:</b> {', '.join(prazo_text)}", styles['Normal']))
                            elements.append(Spacer(1, 6))
                    
                    # Qualidade Objetiva
                    if solution_data.get('qualidade_objetiva'):
                        qualidade = solution_data.get('qualidade_objetiva', {})
                        qualidade_text = []
                        if qualidade.get('deduplicacao_top3_pct'):
                            qualidade_text.append(f"Deduplicação Top 3: {qualidade.get('deduplicacao_top3_pct')}")
                        if qualidade.get('latencia_seg'):
                            qualidade_text.append(f"Latência: {qualidade.get('latencia_seg')} seg")
                        if qualidade.get('cobertura_classificacao_pct'):
                            qualidade_text.append(f"Cobertura de Classificação: {qualidade.get('cobertura_classificacao_pct')}")
                        if qualidade_text:
                            elements.append(Paragraph(f"<b>Qualidade Objetiva:</b> {', '.join(qualidade_text)}", styles['Normal']))
                            elements.append(Spacer(1, 6))
                    
                    # Riscos Chave (prioridade) ou Riscos (fallback)
                    if solution_data.get('riscos_chave') and isinstance(solution_data.get('riscos_chave'), list):
                        elements.append(Paragraph("<b>Riscos Chave:</b>", styles['Normal']))
                        for risco in solution_data.get('riscos_chave', []):
                            elements.append(Paragraph(f"⚠️ {risco}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    elif solution_data.get('riscos') and isinstance(solution_data.get('riscos'), list):
                        elements.append(Paragraph("<b>Riscos:</b>", styles['Normal']))
                        for risco in solution_data.get('riscos', []):
                            elements.append(Paragraph(f"⚠️ {risco}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Mitigações
                    if solution_data.get('mitigacoes') and isinstance(solution_data.get('mitigacoes'), list):
                        elements.append(Paragraph("<b>Mitigações:</b>", styles['Normal']))
                        for mit in solution_data.get('mitigacoes', []):
                            elements.append(Paragraph(f"✅ {mit}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Quando Escolher
                    if solution_data.get('quando_escolher'):
                        elements.append(Paragraph(f"<b>Quando Escolher:</b> {solution_data.get('quando_escolher')}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Benefícios
                    if solution_data.get('beneficios') and isinstance(solution_data.get('beneficios'), list):
                        elements.append(Paragraph("<b>Benefícios:</b>", styles['Normal']))
                        for beneficio in solution_data.get('beneficios', []):
                            elements.append(Paragraph(f"💡 {beneficio}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Processamento de Dados
                    if solution_data.get('processamento_dados'):
                        proc = solution_data.get('processamento_dados', {})
                        proc_text = []
                        if proc.get('onde'):
                            proc_text.append(f"Onde: {proc.get('onde')}")
                        if proc.get('contratos'):
                            proc_text.append(f"Contratos: {', '.join(proc.get('contratos', []))}")
                        if proc.get('dados_dormem'):
                            proc_text.append(f"Dados em repouso: {proc.get('dados_dormem')}")
                        if proc_text:
                            elements.append(Paragraph(f"<b>Processamento de Dados:</b> {' | '.join(proc_text)}", styles['Normal']))
                            elements.append(Spacer(1, 6))
                    
                    # Viabilidade Preliminar
                    if solution_data.get('viabilidade_preliminar'):
                        viab = solution_data.get('viabilidade_preliminar', {})
                        viab_text = []
                        if viab.get('tecnica'):
                            viab_text.append(f"Técnica: {viab.get('tecnica')}")
                        if viab.get('economica'):
                            viab_text.append(f"Econômica: {viab.get('economica')}")
                        if viab.get('organizacional'):
                            viab_text.append(f"Organizacional: {viab.get('organizacional')}")
                        if viab_text:
                            elements.append(Paragraph(f"<b>Viabilidade Preliminar:</b> {' | '.join(viab_text)}", styles['Normal']))
                            elements.append(Spacer(1, 6))
                    
                    # Dependências
                    if solution_data.get('dependencias') and isinstance(solution_data.get('dependencias'), list):
                        elements.append(Paragraph("<b>Dependências:</b>", styles['Normal']))
                        for dep in solution_data.get('dependencias', []):
                            elements.append(Paragraph(f"🔗 {dep}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Saídas Esperadas
                    if solution_data.get('saidas_esperadas') and isinstance(solution_data.get('saidas_esperadas'), list):
                        elements.append(Paragraph("<b>Saídas Esperadas:</b>", styles['Normal']))
                        for saida in solution_data.get('saidas_esperadas', []):
                            elements.append(Paragraph(f"📤 {saida}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Maturidade
                    if solution_data.get('maturidade'):
                        elements.append(Paragraph(f"<b>Maturidade:</b> {solution_data.get('maturidade')}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Prazo Estimado de Liberação
                    if solution_data.get('prazo_estimado_liberacao_dias'):
                        elements.append(Paragraph(f"<b>Prazo Estimado de Liberação:</b> {solution_data.get('prazo_estimado_liberacao_dias')} dias", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Indicadores
                    if solution_data.get('indicadores') and isinstance(solution_data.get('indicadores'), list):
                        elements.append(Paragraph("<b>Indicadores:</b>", styles['Normal']))
                        for ind in solution_data.get('indicadores', []):
                            elements.append(Paragraph(f"📈 {ind}", styles['Normal']))
                        elements.append(Spacer(1, 6))
                    
                    # Nota e Margem de Erro
                    elements.append(Paragraph(
                        f"<b>Nota:</b> {solution_item.get('nota', 'N/A')} | <b>Margem de Erro:</b> {solution_item.get('margemErro', 'N/A')}",
                        styles['Normal']
                    ))
                    
                    elements.append(Spacer(1, 20))
        
        # Build PDF - a classe NumberedCanvas gerencia numeração e rodapé automaticamente
        doc.build(elements)
        buffer.seek(0)
        pdf_data = buffer.getvalue()
        
        # Save hash to tracking data
        with open(REPORTS_CSV, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                report_hash,
                session_id,
                now.isoformat(),
                user_ip,
                user_city,
                json.dumps(priorities)
            ])
        
        # Send email with PDF
        try:
            send_email_with_pdf(pdf_data, date_str, time_str, report_hash)
            print(f"✅ Email enviado com sucesso!")
        except Exception as e:
            print(f"❌ Erro ao enviar email: {e}")
            import traceback
            traceback.print_exc()
            # Continue even if email fails - PDF ainda será retornado
        
        # Return PDF
        from flask import Response
        return Response(
            pdf_data,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename=Tribussula_report_{date_str.replace("/", "")}_{time_str.replace(":", "")}.pdf'
            }
        )
    
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Erro ao gerar relatório: {error_msg}")
        import traceback
        traceback.print_exc()
        # Retorna mensagem de erro mais detalhada
        return jsonify({
            'status': 'error', 
            'message': f'Erro ao gerar relatório: {error_msg}',
            'error_type': type(e).__name__
        }), 500

def send_email_with_pdf(pdf_data, date_str, time_str, report_hash):
    """Send PDF report via email"""
    try:
        # Email configuration
        # You may need to configure these via environment variables
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        email_from = os.getenv('EMAIL_FROM', 'noetikaai@gmail.com')
        email_password = os.getenv('EMAIL_PASSWORD', '')
        email_to_str = os.getenv('EMAIL_TO', 'noetikaai@gmail.com, gabriel.silva@ufabc.edu.br')
        
        # Parse multiple recipients (comma or semicolon separated)
        email_to_list = [email.strip() for email in email_to_str.replace(';', ',').split(',') if email.strip()]
        if not email_to_list:
            email_to_list = ['noetikaai@gmail.com']
        
        if not email_password:
            print("⚠️ EMAIL_PASSWORD não configurado. Email não será enviado.")
            print("💡 Configure EMAIL_PASSWORD no arquivo .env ou variável de ambiente")
            return
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = email_from
        msg['To'] = ', '.join(email_to_list)  # String formatada para o header
        msg['Subject'] = f"Relatório Tribússola gerado {date_str} {time_str}"
        
        # Email body
        body = f"""
Relatório Tribússola gerado

Hash: {report_hash}
Data: {date_str}
Hora: {time_str}

Este email contém o relatório PDF em anexo.
"""
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        # Attach PDF
        attachment = MIMEBase('application', 'pdf')
        attachment.set_payload(pdf_data)
        encoders.encode_base64(attachment)
        attachment.add_header(
            'Content-Disposition',
            f'attachment; filename=Tribussula_report_{date_str.replace("/", "")}_{time_str.replace(":", "")}.pdf'
        )
        msg.attach(attachment)
        
        # Send email
        print(f"📧 Tentando enviar email para: {', '.join(email_to_list)}")
        print(f"📧 Servidor SMTP: {smtp_server}:{smtp_port}")
        print(f"📧 De: {email_from}")
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        
        try:
            server.login(email_from, email_password)
            print("✅ Login SMTP realizado com sucesso")
        except smtplib.SMTPAuthenticationError as auth_error:
            print(f"❌ Erro de autenticação: {auth_error}")
            print("💡 Dica: Gmail pode exigir 'Senha de App' se tiver verificação em 2 etapas")
            print("   Obtenha em: https://myaccount.google.com/apppasswords")
            server.quit()
            raise
        
        text = msg.as_string()
        server.sendmail(email_from, email_to_list, text)  # Lista de destinatários
        server.quit()
        
        print(f"✅ Email enviado com sucesso para: {', '.join(email_to_list)}")
    
    except Exception as e:
        print(f"❌ Erro ao enviar email: {e}")
        print(f"   Tipo de erro: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == '__main__':
    import sys
    
    # Porta do backend (sempre 5000 internamente para comunicação com Node.js)
    BACKEND_PORT = int(os.getenv('BACKEND_PORT', 5000))
    
    # Verifica se é desenvolvimento ou produção
    is_production = os.getenv('FLASK_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production' or os.getenv('PORT')
    
    if is_production:
        # Produção: usa Waitress (servidor WSGI)
        from waitress import serve
        print("🚀 Starting Noetika Tracking Backend (PRODUCTION)...")
        print(f"📊 Server running at http://0.0.0.0:{BACKEND_PORT}")
        print("💾 Data will be saved to:", DATA_DIR.absolute())
        print("✅ Using Waitress WSGI server (production-ready)\n")
        serve(app, host='0.0.0.0', port=BACKEND_PORT, threads=4)
    else:
        # Desenvolvimento: usa servidor embutido do Flask
        print("🚀 Starting Noetika Tracking Backend (DEVELOPMENT)...")
        print(f"📊 Server running at http://localhost:{BACKEND_PORT}")
        print("💾 Data will be saved to:", DATA_DIR.absolute())
        print("\n⚠️  WARNING: Development server - not for production!")
        print("   For production, set: FLASK_ENV=production")
        print(f"   Or use: waitress-serve --host=0.0.0.0 --port={BACKEND_PORT} backend:app\n")
        app.run(debug=True, host='0.0.0.0', port=BACKEND_PORT)

