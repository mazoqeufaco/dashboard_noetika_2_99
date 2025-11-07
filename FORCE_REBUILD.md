# Forçar Rebuild no Railway

Se o Railway não detectar mudanças, você pode:

1. Fazer um commit vazio (sem mudanças):
   ```bash
   git commit --allow-empty -m "Force rebuild - use Dockerfile"
   git push origin main
   ```

2. Ou modificar o Dockerfile levemente (já foi feito - comentário com timestamp)

3. Ou na interface do Railway:
   - Vá em "Deployments"
   - Clique em "Redeploy" no último deployment
   - Ou crie um novo deployment manual

