# Documentación

Cada documento responde al anterior. Leelos en este orden:

| # | Documento | Qué responde | Responde a |
|---|---|---|---|
| 1 | [PRD](PRD.md) | Qué problema resuelve el sitio, para quién y cómo se mide | — |
| 2 | [Design](DESIGN.md) | Cómo se ve y por qué: tokens, componentes, layouts | PRD: O4, RF8, RF9, RNF1 |
| 3 | [Technical Design](TECH-DESIGN.md) | Cómo está construido: arquitectura, datos, flujos | PRD: todos los RF y RNF |
| 4 | [ADRs](adr/README.md) | Las decisiones de arquitectura, una por archivo | Technical Design |
| 5 | [Backlog](../BACKLOG.md) | Qué falta, qué se hizo y qué se descartó | PRD (cada ítem cita su RF) |
| 6 | Spec + Tasks | El detalle de cada cambio: [`openspec/`](../openspec/README.md) para los cambios pasados; los nuevos, con un documento de feature por cambio | Backlog |
| 7 | Código + Review | Cada cambio entra por un PR revisado, con CI en verde ([PRs](https://github.com/miguel-anay/blog-cv/pulls?q=is%3Apr)) | Spec + Tasks |
| 8 | [Seguridad](SECURITY.md) | El pase de seguridad sobre el código | PRD: RF6, RNF2, RNF3 |
| 9 | [Deploy](DEPLOY.md) | Cómo se despliega, se verifica y se revierte | Technical Design |

Además:
- [`CHANGELOG.md`](../CHANGELOG.md): los cambios notables.
- [`CLAUDE.md`](../CLAUDE.md): las reglas que siguen los agentes en este repo.
- [`archive/`](archive/): documentos del stack anterior (Strapi + AWS), que se conservan como historia.

> Esta cadena documental se escribió en noviembre de 2026, con el sitio ya en producción. Cada documento
> describe el producto actual; las decisiones previas quedaron registradas como ADR.
