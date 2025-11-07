# 🔑 Como Gerar Senha de App do Gmail (2025)

## ⚠️ IMPORTANTE: Chave de Acesso ≠ Senha de App

**Chaves de Acesso (Passkeys)** são para login em sites/apps.
**Senhas de App** são para autenticação SMTP (envio de emails).

## ✅ Passo a Passo

### 1. Ativar Verificação em Duas Etapas (OBRIGATÓRIO)

⚠️ **Você PRECISA ter verificação em 2 etapas ativada antes!**

1. Acesse: https://myaccount.google.com/security
2. Procure a seção **"Como fazer login no Google"**
3. Clique em **"Verificação em duas etapas"**
4. Siga as instruções para ativar
5. Configure seu telefone ou app autenticador

### 2. Gerar Senha de App

**OPÇÃO A: Link Direto (se estiver disponível)**
- Acesse: https://myaccount.google.com/apppasswords
- Se não aparecer, continue com Opção B

**OPÇÃO B: Via Configurações**
1. Vá em: https://myaccount.google.com/security
2. Procure por **"Senhas de app"** ou **"App passwords"**
3. Se não aparecer, **verifique se a verificação em 2 etapas está realmente ativada**
4. Clique em **"Senhas de app"**
5. Selecione:
   - **App:** Email
   - **Dispositivo:** Outro (Personalizado) → Digite "Tribússola"
6. Clique em **"Gerar"**
7. Copie a senha de **16 caracteres** (com ou sem espaços)

### 3. Configurar no Projeto

1. Abra o arquivo `.env`
2. Substitua a linha:
   ```
   EMAIL_PASSWORD=gibor137
   ```
   Por:
   ```
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   ```
   (Use a senha de 16 caracteres gerada)

3. Salve o arquivo

### 4. Testar

Execute:
```bash
python test_email.py
```

## 🔍 Se Não Conseguir Gerar Senha de App

### Verifique:

1. ✅ Verificação em 2 etapas está **REALMENTE ATIVA**?
   - Teste fazendo login no Gmail em outro navegador/privado
   - Deve pedir código de verificação

2. ✅ Conta é pessoal ou corporativa?
   - Contas corporativas podem ter restrições do administrador

3. ✅ Conta é muito nova?
   - Algumas contas novas precisam de tempo para habilitar

### Alternativas:

Se não conseguir gerar senha de app, você pode:

1. **Usar OAuth2** (mais complexo, mas mais seguro)
2. **Usar outro serviço de email:**
   - SendGrid (gratuito até 100 emails/dia)
   - Mailgun (gratuito até 5.000 emails/mês)
   - AWS SES (gratuito até 62.000 emails/mês)

## 📝 Notas

- Senhas de app são específicas para cada app/dispositivo
- Você pode gerar várias senhas de app diferentes
- Se não funcionar mais, gere uma nova
- Senhas de app são diferentes da senha normal do Gmail

## ✅ Verificação

Após configurar, você deve ver:
```
✅ Login SMTP realizado com sucesso
✅ Email enviado!
```

Se aparecer erro 535, a senha ainda está incorreta.



