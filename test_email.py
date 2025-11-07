#!/usr/bin/env python3
"""
Script de teste para verificar envio de email
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()

# Configurações
smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
smtp_port = int(os.getenv('SMTP_PORT', '587'))
email_from = os.getenv('EMAIL_FROM', 'noetikaai@gmail.com')
email_password = os.getenv('EMAIL_PASSWORD', '')
email_to_str = os.getenv('EMAIL_TO', 'noetikaai@gmail.com, gabriel.silva@ufabc.edu.br')

print("=" * 60)
print("TESTE DE ENVIO DE EMAIL")
print("=" * 60)
print(f"\n📧 Servidor SMTP: {smtp_server}:{smtp_port}")
print(f"📧 De: {email_from}")
print(f"📧 Para: {email_to_str}")
print(f"📧 Senha configurada: {'✅ Sim' if email_password else '❌ Não'}")

if not email_password:
    print("\n❌ ERRO: EMAIL_PASSWORD não configurado no .env")
    exit(1)

# Parse destinatários
email_to_list = [email.strip() for email in email_to_str.replace(';', ',').split(',') if email.strip()]

print(f"\n📧 Destinatários: {email_to_list}")
print("\n" + "=" * 60)
print("Tentando conectar ao servidor SMTP...")
print("=" * 60)

try:
    # Conecta ao servidor
    print(f"\n1️⃣ Conectando a {smtp_server}:{smtp_port}...")
    server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
    print("✅ Conexão estabelecida!")
    
    # Inicia TLS
    print("\n2️⃣ Iniciando TLS...")
    server.starttls()
    print("✅ TLS iniciado!")
    
    # Tenta fazer login
    print(f"\n3️⃣ Tentando login com {email_from}...")
    try:
        server.login(email_from, email_password)
        print("✅ Login realizado com sucesso!")
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n❌ ERRO DE AUTENTICAÇÃO!")
        print(f"   Código: {e.smtp_code}")
        print(f"   Mensagem: {e.smtp_error.decode('utf-8') if isinstance(e.smtp_error, bytes) else e.smtp_error}")
        print(f"\n💡 POSSÍVEIS SOLUÇÕES:")
        print(f"   1. A senha está incorreta")
        print(f"   2. Gmail requer 'Senha de App' se tiver 2FA ativado")
        print(f"   3. Verifique se 'Acesso de apps menos seguros' está ativado")
        print(f"   4. Tente gerar uma nova senha de app")
        server.quit()
        exit(1)
    except Exception as e:
        print(f"\n❌ ERRO NO LOGIN: {type(e).__name__}")
        print(f"   {str(e)}")
        server.quit()
        exit(1)
    
    # Cria email de teste
    print("\n4️⃣ Criando email de teste...")
    msg = MIMEMultipart()
    msg['From'] = email_from
    msg['To'] = ', '.join(email_to_list)
    msg['Subject'] = "Teste de Email - Tribússola"
    
    body = """
Este é um email de teste do sistema Tribússola.

Se você recebeu este email, a configuração está funcionando corretamente!
"""
    msg.attach(MIMEText(body, 'plain', 'utf-8'))
    
    # Envia email
    print("\n5️⃣ Enviando email...")
    text = msg.as_string()
    server.sendmail(email_from, email_to_list, text)
    print("✅ Email enviado!")
    
    # Fecha conexão
    server.quit()
    print("\n✅ TESTE CONCLUÍDO COM SUCESSO!")
    print(f"   Verifique a caixa de entrada de: {', '.join(email_to_list)}")
    print(f"   (também verifique a pasta de spam)")
    
except smtplib.SMTPConnectError as e:
    print(f"\n❌ ERRO DE CONEXÃO!")
    print(f"   Não foi possível conectar ao servidor {smtp_server}:{smtp_port}")
    print(f"   Erro: {str(e)}")
    print(f"\n💡 Verifique sua conexão com a internet")
    
except smtplib.SMTPException as e:
    print(f"\n❌ ERRO SMTP!")
    print(f"   Tipo: {type(e).__name__}")
    print(f"   Mensagem: {str(e)}")
    
except Exception as e:
    print(f"\n❌ ERRO INESPERADO!")
    print(f"   Tipo: {type(e).__name__}")
    print(f"   Mensagem: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)



