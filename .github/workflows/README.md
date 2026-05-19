# GitHub Actions Workflows

## deploy.yml

Este workflow automatiza el despliegue del sitio Astro a AWS S3 con integración de Cloudflare.

### Triggers

- **Push a `main`**: Despliegue automático en producción
- **Pull Request a `main`**: Build de validación (sin despliegue)
- **Manual (`workflow_dispatch`)**: Despliegue manual desde GitHub UI

### Pasos del Workflow

1. **Checkout**: Clona el repositorio
2. **Setup Node.js**: Configura Node.js v20 con cache de npm
3. **Install**: Instala dependencias con `npm ci`
4. **Build**: Compila el sitio Astro
5. **Configure AWS**: Configura credenciales AWS
6. **Sync to S3**: Sube archivos a S3 con headers de cache optimizados
7. **Invalidate CloudFront**: Invalida caché de CloudFront (opcional)
8. **Purge Cloudflare**: Purga caché de Cloudflare (opcional)
9. **Summary**: Genera resumen del despliegue

### Secrets Requeridos

#### AWS (Obligatorios)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`

#### Strapi (Opcional)
- `PUBLIC_STRAPI_URL`

#### CloudFront (Opcional)
- `CLOUDFRONT_DISTRIBUTION_ID`

#### Cloudflare (Opcional)
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_API_TOKEN`

### Cache Strategy

**Assets estáticos** (JS, CSS, imágenes):
```
Cache-Control: public, max-age=31536000, immutable
```

**HTML files**:
```
Cache-Control: public, max-age=0, must-revalidate
```

### Ejecución Manual

1. Ve a **Actions** tab en GitHub
2. Selecciona **Deploy to S3 and Cloudflare**
3. Click en **Run workflow**
4. Selecciona la rama y ejecuta

### Monitoring

- Logs disponibles en la pestaña **Actions**
- Resumen del despliegue en la sección **Summary** de cada run
- Notificaciones por email de GitHub si falla

### Troubleshooting

**Error: AWS credentials not configured**
- Verifica que los secrets `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` estén configurados

**Error: Access Denied al hacer sync**
- Verifica los permisos del usuario IAM
- Confirma que el bucket existe y el nombre es correcto

**Build falla**
- Revisa los logs para ver el error específico
- Verifica que todas las dependencias estén en `package.json`
- Comprueba que no haya errores de TypeScript

### Optimizaciones Futuras

- [ ] Agregar tests antes del deploy
- [ ] Implementar staging environment
- [ ] Agregar lighthouse CI para performance checks
- [ ] Notificaciones a Slack/Discord
- [ ] Rollback automático en caso de errores
