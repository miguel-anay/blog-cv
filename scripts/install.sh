#!/usr/bin/env bash
set -euo pipefail

GLOBAL_COMMANDS="$HOME/.claude/commands"
PROJECT_COMMANDS=".claude/commands"

echo "Instalando comandos de Claude Code..."

# Crear directorio global si no existe
mkdir -p "$GLOBAL_COMMANDS"

# Copiar comandos del proyecto al directorio global
for cmd in publish-articulo publish-curso publish-ordenar; do
  src="$PROJECT_COMMANDS/${cmd}.md"
  dst="$GLOBAL_COMMANDS/${cmd}.md"

  if [ ! -f "$src" ]; then
    echo "  ✗ No se encontró $src — ejecutá este script desde la raíz del proyecto"
    exit 1
  fi

  cp "$src" "$dst"
  echo "  ✓ /publish-${cmd#publish-} instalado globalmente"
done

echo ""
echo "Listo. Los comandos están disponibles en cualquier proyecto de Claude Code:"
echo "  /publish-ordenar   — prerrequisito: organiza material, sube a Drive, GitHub y Vimeo"
echo "  /publish-articulo  — publicar un artículo en el blog"
echo "  /publish-curso     — publicar un curso con secciones y recursos"
echo ""
echo "También están disponibles localmente en .claude/commands/ para este proyecto."
